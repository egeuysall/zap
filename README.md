# Zap

Downloader-first video workspace with a YouTube-like web interface, a terminal
CLI, native uploads, offline queues, and Convex-backed job state and storage.

## Stack

- Next.js 16, React 19, Tailwind 4, and shadcn/ui
- Clerk authentication with a Convex JWT template
- Convex database, real-time subscriptions, HTTP worker API, and file storage
- Bun worker using `yt-dlp`, `ffmpeg`, and `ffprobe`
- Optional Redis Streams queue through Bun's native Redis client
- IndexedDB for browser-side queued work

## Prerequisites

```sh
bun install
```

Only the hosted worker needs `yt-dlp`, `ffmpeg`, and `ffprobe`; CLI users do
not. Redis is optional.

The project is already linked to the Clerk app from the setup brief. Verify it
with:

```sh
clerk doctor
bunx convex dev --once
```

Convex needs `CLERK_JWT_ISSUER_DOMAIN` and `WORKER_SECRET`. They are configured
on the current development deployment. Retrieve or rotate the worker secret
with `bunx convex env get WORKER_SECRET` / `bunx convex env set WORKER_SECRET`.

## Run locally

Use separate terminals:

```sh
bun run dev:convex
bun run dev
```

Run the downloader worker against the Convex HTTP endpoint:

```sh
WORKER_API_BASE_URL=https://<deployment>.convex.site \
WORKER_TOKEN="$(bunx convex env get WORKER_SECRET)" \
bun run worker
```

Or run the worker with Redis Streams:

```sh
redis-server
WORKER_QUEUE=redis REDIS_URL=redis://localhost:6379 bun run worker
```

## CLI

```sh
curl -fsSL https://zap.egeuysal.com/install.sh | bash
zap login
zap download "https://youtube.com/watch?v=..." --format mp4
zap local "https://youtube.com/watch?v=..."
zap self-update

# From this checkout:
bun run cli -- --help
bun run cli -- download "https://youtube.com/watch?v=..." --json
```

CLI YouTube downloads save to `~/Downloads`. Use `zap download <url>` for
remote processing or `zap local <url>` to process with local `yt-dlp` and
`ffmpeg`.
Video downloads default to 1080p with automatic fallback to the highest
available lower quality.
Run `zap login` for browser auth, or `zap login --api-key zak_...` for automation.

## Verify

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

Only download media you own or are authorized to retrieve.
