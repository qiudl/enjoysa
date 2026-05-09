// Command backfill-en enqueues ZH→EN translation tasks for products that
// were created before REQ-20260509-0004 shipped (i.e. Chinese-only inventory
// from the era when the supplier-side EN→ZH pipeline was the only AI
// translation in the system). It is a one-shot tool — run it once after the
// admin ZH→EN feature ships, then archive.
//
// Idempotency: skips products with manual_override_en=true and products that
// already have a pending or running zh2en task. Safe to re-run.
//
// Throttling: --rate caps how many enqueues per second so the backfill
// cannot starve real-time admin/supplier traffic on the shared LLM quota.
//
// Example:
//
//	go run ./cmd/backfill-en --dry-run --limit=10
//	go run ./cmd/backfill-en --batch-size=100 --rate=1
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"enjoysa-backend/internal/core/config"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/internal/translation"

	"golang.org/x/time/rate"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	var (
		configPath = flag.String("config", "configs/config.yaml", "path to config file")
		dryRun     = flag.Bool("dry-run", false, "list candidate products without enqueueing tasks")
		limit      = flag.Int("limit", 0, "maximum number of products to process (0 = unlimited)")
		batchSize  = flag.Int("batch-size", 100, "products per batch (used to print progress)")
		ratePerSec = flag.Float64("rate", 1.0, "enqueue rate cap, requests per second")
		verbose    = flag.Bool("verbose", false, "print verbose gorm logs")
	)
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	dbLogLevel := logger.Silent
	if *verbose {
		dbLogLevel = logger.Info
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(dbLogLevel),
	})
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	pStore := productstore.NewProductStore(db)
	tStore := translation.NewStore(db)

	ids, err := pStore.ListZhOnlyProductIDs(*limit)
	if err != nil {
		log.Fatalf("list candidates: %v", err)
	}

	if len(ids) == 0 {
		log.Println("no zh-only products to backfill — nothing to do")
		return
	}

	log.Printf("found %d candidate product(s) (limit=%d)", len(ids), *limit)
	if *dryRun {
		printDryRun(db, ids)
		return
	}

	limiter := rate.NewLimiter(rate.Limit(*ratePerSec), 1)
	ctx := context.Background()

	var enqueued, skipped, errored int
	startedAt := time.Now()

	for i, id := range ids {
		if err := limiter.Wait(ctx); err != nil {
			log.Fatalf("rate limiter aborted: %v", err)
		}

		product, err := pStore.GetByID(id)
		if err != nil {
			errored++
			log.Printf("[%d/%d] product=%d load failed: %v", i+1, len(ids), id, err)
			continue
		}
		if product.ManualOverrideEn {
			skipped++
			continue
		}
		fields := zhFields(product)
		if len(fields) == 0 {
			skipped++
			continue
		}

		// Idempotency: skip when a zh2en task is already in flight.
		inflight, err := tStore.HasInflight(translation.TargetTypeProduct, id, translation.DirectionZH2EN)
		if err != nil {
			errored++
			log.Printf("[%d/%d] product=%d hasInflight failed: %v", i+1, len(ids), id, err)
			continue
		}
		if inflight {
			skipped++
			continue
		}

		// Build a service-less enqueue: we don't need the gate (already
		// pre-checked manual_override_en above) and can write directly
		// via the store.
		input, _ := json.Marshal(fields)
		task := &translation.TranslationTask{
			TargetType:  translation.TargetTypeProduct,
			TargetID:    id,
			Direction:   translation.DirectionZH2EN,
			Status:      translation.StatusPending,
			MaxRetries:  2,
			FieldsInput: input,
		}
		if err := tStore.CreateInTx(nil, task); err != nil {
			errored++
			log.Printf("[%d/%d] product=%d enqueue failed: %v", i+1, len(ids), id, err)
			continue
		}
		enqueued++

		if (i+1)%*batchSize == 0 || i+1 == len(ids) {
			elapsed := time.Since(startedAt).Round(time.Second)
			log.Printf("progress: %d/%d processed (enqueued=%d skipped=%d errored=%d) elapsed=%s",
				i+1, len(ids), enqueued, skipped, errored, elapsed)
		}
	}

	log.Printf("done: enqueued=%d skipped=%d errored=%d total_processed=%d in %s",
		enqueued, skipped, errored, len(ids), time.Since(startedAt).Round(time.Second))
	if errored > 0 {
		os.Exit(1)
	}
}

func zhFields(p *productmodel.Product) map[string]string {
	out := map[string]string{}
	if p.NameZh != "" {
		out["name"] = p.NameZh
	}
	if p.SummaryZh != "" {
		out["summary"] = p.SummaryZh
	}
	if p.DescriptionZh != "" {
		out["description"] = p.DescriptionZh
	}
	if p.AddressZh != "" {
		out["address"] = p.AddressZh
	}
	return out
}

// printDryRun prints a plain listing of the candidate products so the
// operator can sample-check what backfill would touch before letting it
// fire LLM calls.
func printDryRun(db *gorm.DB, ids []uint) {
	fmt.Printf("=== DRY RUN — %d candidate(s) ===\n", len(ids))
	fmt.Println("id\tname_zh\tname_en")
	for _, id := range ids {
		var p productmodel.Product
		if err := db.Select("id", "name_zh", "name_en").First(&p, id).Error; err != nil {
			fmt.Printf("%d\tERROR: %v\n", id, err)
			continue
		}
		fmt.Printf("%d\t%s\t%q\n", p.ID, p.NameZh, p.NameEn)
	}
	fmt.Println("=== no tasks enqueued — pass without --dry-run to run for real ===")
}

