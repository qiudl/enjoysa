package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"enjoysa-backend/internal/core/config"
	productmodel "enjoysa-backend/internal/product/model"
	"enjoysa-backend/internal/seed"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	clean := flag.Bool("clean", false, "Clean all business tables before seeding")
	dump := flag.Bool("dump", false, "Dump seed data to SQL file after seeding")
	verbose := flag.Bool("verbose", false, "Print verbose logs")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	logLevel := logger.Silent
	if *verbose {
		logLevel = logger.Info
	}

	dsn := cfg.Database.DSN()

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// Ensure schema is up to date (add new columns like metadata)
	db.AutoMigrate(&productmodel.Product{})

	seeder := seed.NewSeeder(db)

	start := time.Now()

	if *clean {
		fmt.Println("🧹 Cleaning business tables...")
		if err := seeder.Clean(); err != nil {
			log.Fatalf("Clean failed: %v", err)
		}
		fmt.Println("✅ Clean done")
	}

	fmt.Println("🌱 Seeding data...")
	if err := seeder.Seed(); err != nil {
		log.Fatalf("Seed failed: %v", err)
	}

	seeder.PrintSummary()
	fmt.Printf("\n⏱️  Total time: %s\n", time.Since(start).Round(time.Millisecond))

	if *dump {
		fmt.Println("\n📦 Dumping to seeds/seed.sql...")
		dumpPath := "seeds/seed.sql"
		os.MkdirAll("seeds", 0755)
		dumpCmd := exec.Command("pg_dump",
			"-h", cfg.Database.Host,
			"-p", fmt.Sprintf("%d", cfg.Database.Port),
			"-U", cfg.Database.User,
			"-d", cfg.Database.DBName,
			"--data-only",
			"--inserts",
			"--exclude-table=sys_*",
			"--exclude-table=casbin_rule",
			"-f", dumpPath,
		)
		dumpCmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", cfg.Database.Password))
		dumpCmd.Stdout = os.Stdout
		dumpCmd.Stderr = os.Stderr
		if err := dumpCmd.Run(); err != nil {
			log.Fatalf("Dump failed: %v", err)
		}
		fmt.Printf("✅ Dumped to %s\n", dumpPath)
	}
}
