FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# REQ-20260506-0056: also build the seed binary so demo can populate full
# fixture data via `docker compose exec backend ./seed --clean`. Prod won't
# invoke this binary in normal operation, only ssh-in operators can.
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server/ && \
    CGO_ENABLED=0 GOOS=linux go build -o /seed ./cmd/seed/ && \
	CGO_ENABLED=0 GOOS=linux go build -o /import-restaurant-botanic ./cmd/import-restaurant-botanic/ && \
	CGO_ENABLED=0 GOOS=linux go build -o /import-barossa-restaurants ./cmd/import-barossa-restaurants/ && \
	CGO_ENABLED=0 GOOS=linux go build -o /import-regional-food-drink ./cmd/import-regional-food-drink/ && \
	CGO_ENABLED=0 GOOS=linux go build -o /import-luxury-accommodation ./cmd/import-luxury-accommodation/ && \
	CGO_ENABLED=0 GOOS=linux go build -o /import-curated-sa-experiences ./cmd/import-curated-sa-experiences/
RUN CGO_ENABLED=0 GOOS=linux go build -o /backfill-booking-notices ./cmd/backfill-booking-notices/

FROM alpine:3.19

# wget is in the busybox-extras image already on alpine, but the busybox
# applet is sufficient — explicit wget package keeps the HEALTHCHECK
# self-contained even if alpine drops the busybox applet later.
RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app
COPY --from=builder /server /seed /import-restaurant-botanic /import-barossa-restaurants /import-regional-food-drink /import-luxury-accommodation /import-curated-sa-experiences ./
COPY --from=builder /backfill-booking-notices ./
COPY configs/ configs/
COPY assets/ assets/

RUN mkdir -p uploads

EXPOSE 6080

# REQ-20260506-0013: HEALTHCHECK lets `docker compose up --wait` block until
# the new backend is actually serving, eliminating the false-positive where
# deploy reports success while the container is still booting.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q -O - http://localhost:6080/health || exit 1

CMD ["./server", "-config", "configs/config.production.yaml"]
