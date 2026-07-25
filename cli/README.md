# zap CLI

Minimal Bun CLI for Zap downloader operations.

```sh
cd cli
bun test
bun src/index.ts --help
bun src/index.ts login --endpoint http://localhost:3000
bun src/index.ts download "https://example.com/watch?v=1"
bun src/index.ts download "https://example.com/watch?v=1" --json
```

`zap download <url>` runs remotely. `zap local <url>` uses this Mac's
`yt-dlp` and `ffmpeg`. Both save to `~/Downloads`.
Video downloads default to 1080p with lower-quality fallback.
