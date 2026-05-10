// REQ-20260510-0003: stock_sold backfill CLI.
//
// Scans every limited (stock_total != -1) package, recomputes stock_sold
// from orders (SUM(quantity) WHERE status NOT IN cancelled/refunded), and
// in --commit mode UPDATEs each row whose stored value drifted.
//
// Defaults to dry-run; never writes unless --commit is passed. Each commit
// is its own single-row transaction so a mid-run crash leaves only the
// untouched tail; already-fixed rows are idempotent and safe to rerun.
//
//	./stock-backfill --dry-run             # report only
//	./stock-backfill --commit              # apply all
//	./stock-backfill --commit --limit=10   # apply only the first 10 drifted rows
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"enjoysa-backend/internal/core/config"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	dryRun := flag.Bool("dry-run", false, "report drifted rows without writing")
	commit := flag.Bool("commit", false, "apply UPDATEs (default is report-only)")
	limit := flag.Int("limit", 0, "only process the first N drifted packages (0 = no limit)")
	verbose := flag.Bool("verbose", false, "print every package query timing")
	flag.Parse()

	if !*dryRun && !*commit {
		fmt.Fprintln(os.Stderr, "must pass --dry-run or --commit")
		os.Exit(2)
	}
	if *dryRun && *commit {
		fmt.Fprintln(os.Stderr, "--dry-run and --commit are mutually exclusive")
		os.Exit(2)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	logLevel := gormlogger.Silent
	if *verbose {
		logLevel = gormlogger.Info
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	store := productstore.NewProductStore(db)

	// Stream limited packages in id order. We don't paginate because the
	// table is small (one row per SKU); a full scan with a single-column
	// projection is cheap.
	var pkgs []productmodel.ProductPackage
	if err := db.Where("stock_total != -1").Order("id ASC").Find(&pkgs).Error; err != nil {
		log.Fatalf("Failed to load packages: %v", err)
	}

	mode := "DRY-RUN"
	if *commit {
		mode = "COMMIT"
	}
	fmt.Printf("[stock-backfill %s] scanning %d limited packages\n", mode, len(pkgs))

	driftCount := 0
	processed := 0
	totalElapsed := time.Duration(0)
	maxElapsed := time.Duration(0)

	for _, pkg := range pkgs {
		start := time.Now()
		realSold, err := store.RecomputeStockSoldFromOrders(pkg.ID, nil)
		elapsed := time.Since(start)
		totalElapsed += elapsed
		if elapsed > maxElapsed {
			maxElapsed = elapsed
		}

		if err != nil {
			log.Printf("pkg=%d recompute failed: %v", pkg.ID, err)
			continue
		}

		if *verbose {
			fmt.Printf("pkg=%d product=%d stock_sold=%d real=%d (%v)\n",
				pkg.ID, pkg.ProductID, pkg.StockSold, realSold, elapsed)
		}

		if realSold == pkg.StockSold {
			continue
		}

		driftCount++
		diff := realSold - pkg.StockSold
		fmt.Printf("DRIFT pkg=%d product=%d stock_sold %d → %d (diff %+d)\n",
			pkg.ID, pkg.ProductID, pkg.StockSold, realSold, diff)

		if *commit {
			if err := db.Model(&productmodel.ProductPackage{}).
				Where("id = ?", pkg.ID).
				Update("stock_sold", realSold).Error; err != nil {
				log.Printf("pkg=%d UPDATE failed: %v", pkg.ID, err)
				continue
			}
			processed++
			if *limit > 0 && processed >= *limit {
				fmt.Printf("--limit %d reached, stopping\n", *limit)
				break
			}
		}

		if elapsed > 200*time.Millisecond {
			fmt.Printf("  ⚠️  pkg=%d query took %v (>200ms threshold)\n", pkg.ID, elapsed)
		}
	}

	avgElapsed := time.Duration(0)
	if len(pkgs) > 0 {
		avgElapsed = totalElapsed / time.Duration(len(pkgs))
	}

	fmt.Println("---")
	fmt.Printf("scanned: %d packages\n", len(pkgs))
	fmt.Printf("drifted: %d\n", driftCount)
	if *commit {
		fmt.Printf("committed: %d\n", processed)
	}
	fmt.Printf("query timing: avg %v / max %v\n", avgElapsed, maxElapsed)
}
