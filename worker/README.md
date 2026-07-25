# Downloader worker

Standalone Bun worker for media download jobs. It shells out to installed `yt-dlp`, `ffmpeg`, and `ffprobe` with argv arrays only.

## Run

```sh
WORKER_API_BASE_URL=https://your-convex-site.convex.site \
WORKER_TOKEN=replace-me \
bun worker/index.ts
```

Required tools:

- `yt-dlp`
- `ffmpeg`
- `ffprobe`

## Convex HTTP contract

Expose these authenticated HTTP endpoints from Convex:

- `POST /api/worker/jobs/lease` with `{ workerId, leaseMs }`, returns `{ job: null }` or `{ job: { _id, url, format, quality } }`.
- `POST /api/worker/jobs/progress` with `{ jobId, workerId, status, progress?, message? }`, returns `{ cancel?: true }` when the worker should stop.
- `POST /api/worker/storage/upload-url` with `{ jobId, workerId, filename, contentType }`, returns `{ uploadUrl }` from `ctx.storage.generateUploadUrl()`.
- `POST /api/worker/jobs/complete` with `{ jobId, workerId, storageId, title, contentType, sizeBytes }`.
- `POST /api/worker/jobs/fail` with `{ jobId, workerId, error }`.

The worker validates `http`/`https` URLs, rejects local/private network targets, uses temp directories, enforces subprocess timeouts, probes the output media, uploads to Convex storage, and removes temp files.

## Optional Redis Streams queue

Convex HTTP leasing is the default. To consume Redis Streams instead, run with:

```sh
WORKER_QUEUE=redis \
REDIS_URL=redis://localhost:6379 \
bun worker/index.ts
```

Defaults:

- `REDIS_JOBS_STREAM=zap:downloads`
- `REDIS_EVENTS_STREAM=zap:download-events`
- `REDIS_GROUP=downloaders`

Each Redis job entry can store either flat fields or a JSON `payload` field. The parsed job must include `url` and `uploadUrl`; Redis mode emits `progress`, `complete`, and `fail` events to `REDIS_EVENTS_STREAM` and `XACK`s the job after completion or failure.

## Test

```sh
bun test worker
```
