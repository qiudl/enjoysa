package translation

import (
	"context"
	"runtime/debug"
	"time"

	"enjoysa-backend/internal/core/logger"
)

// StartWorker spawns a goroutine that polls the translation_tasks table for
// pending work and processes one task per tick. It panic-recovers so the
// worker survives transient bugs without taking the server down.
func StartWorker(ctx context.Context, svc *Service) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Errorf("[translation] worker panic: %v\n%s", r, debug.Stack())
				// Self-restart after a short delay so a poison message doesn't
				// hot-loop. ctx cancellation still wins.
				select {
				case <-ctx.Done():
					return
				case <-time.After(5 * time.Second):
					StartWorker(ctx, svc)
				}
			}
		}()

		// Recover any tasks left in `running` state by a previous worker
		// (e.g. process killed mid-LLM-call).
		if n, err := svc.Store().ResetStuckRunning(5 * time.Minute); err != nil {
			logger.Warnf("[translation] reset stuck running failed: %v", err)
		} else if n > 0 {
			logger.Infof("[translation] reset %d stuck running tasks", n)
		}

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		logger.Info("[translation] worker started")
		for {
			select {
			case <-ctx.Done():
				logger.Info("[translation] worker stopping")
				return
			case <-ticker.C:
				// Drain pending queue this tick — processOne returns false
				// when nothing is left, so we loop until empty.
				for {
					processed, err := svc.ProcessOne(ctx)
					if err != nil {
						logger.Warnf("[translation] task error: %v", err)
					}
					if !processed {
						break
					}
					// Yield between tasks so a flood doesn't starve other DB work.
					select {
					case <-ctx.Done():
						return
					case <-time.After(50 * time.Millisecond):
					}
				}
			}
		}
	}()
}
