# Worker API

Browser job submission uses Clerk-authenticated Convex mutations:

- `api.downloads.createJob({ url, format, quality })`
- `api.downloads.getMine({ jobId })`
- `api.downloads.listMine({ limit })`
- `api.downloads.cancel({ jobId })`

External workers use Convex HTTP endpoints with:

```http
Authorization: Bearer <WORKER_SECRET>
Content-Type: application/json
```

## Lease

`POST /api/worker/jobs/lease`

```json
{ "workerId": "worker-1", "leaseMs": 300000 }
```

Returns `{ "job": null }` or a job with `_id`, `url`, `format`, and `quality`.

## Upload

`POST /api/worker/storage/upload-url`

Returns `{ "uploadUrl": "..." }`. Upload the completed media to that URL, then
send the returned Convex storage id to the complete endpoint.

## Progress

`POST /api/worker/jobs/progress`

```json
{ "jobId": "...", "workerId": "worker-1", "progress": 42 }
```

## Complete

`POST /api/worker/jobs/complete`

```json
{
  "jobId": "...",
  "workerId": "worker-1",
  "storageId": "...",
  "title": "Video title",
  "contentType": "video/mp4",
  "durationSeconds": 123,
  "sizeBytes": 456789
}
```

Completion creates a `videos` row owned by the user who submitted the job.

## Fail

`POST /api/worker/jobs/fail`

```json
{ "jobId": "...", "workerId": "worker-1", "error": "yt-dlp failed" }
```

## CLI Constraint

Local CLI downloads should run directly against local paths without cloud auth.
Cloud job submission from CLI needs a user auth/API-key flow later; this backend
only supports Clerk-authenticated browser submission and `WORKER_SECRET`
worker automation.
