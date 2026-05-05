FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server/

FROM alpine:3.19

# wget is in the busybox-extras image already on alpine, but the busybox
# applet is sufficient — explicit wget package keeps the HEALTHCHECK
# self-contained even if alpine drops the busybox applet later.
RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app
COPY --from=builder /server .
COPY configs/ configs/

RUN mkdir -p uploads

EXPOSE 6080

# REQ-20260506-0013: HEALTHCHECK lets `docker compose up --wait` block until
# the new backend is actually serving, eliminating the false-positive where
# deploy reports success while the container is still booting.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q -O - http://localhost:6080/health || exit 1

CMD ["./server", "-config", "configs/config.production.yaml"]
