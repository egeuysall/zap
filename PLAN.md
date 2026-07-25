# Downloader

Make it so you also build a YouTube interface and people can open that as a website or locally and upload and watch their videos, maybe accounts and stuff if online? With an offline backup in caches by indexed DB.

This situation requires designing an **Architectural Design Document (ADD)**, not just a development roadmap. Since your core bottleneck—media extraction and transcoding—is computationally intensive and stateful, we must adopt a decoupled, event-driven microservices pattern.

We will leverage TypeScript/Next.js for the Vercel side due to its seamless integration with modern edge tooling, while using external resources for the actual heavy lifting. Convex is the ideal solution to eliminate API polling complexity.

---

## 🏗️ I. Architectural Blueprint: Event-Driven Pipeline

The system will be composed of five distinct, communicating services:

1.  **Client Interface (Next.js/Vercel):** The frontend that initiates jobs and subscribes to status changes.
2.  **API Gateway & Job Initiator ($\text{TS}$ / Next.js API Routes):** Validates input, creates the initial record in Convex, and publishes the raw job payload.
3.  **State Manager (Convex):** The single source of truth for job status (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED`/`FAILED`). Eliminates client-side polling loops.
4.  **Job Queue Broker ($\text{Redis Streams}$):** Decouples the API Gateway from the Workers. It acts as a persistent buffer of jobs waiting for execution.
5.  **Worker Pool Cluster (External VPS/Container Service):** Consumes from Redis, executes resource-heavy binaries (`yt-dlp`, `ffmpeg`), and writes results back to the Data Store via an outbound call to Convex's API.

### $\text{Conceptual Data Flow}$

$$\text{Client} \xrightarrow{\text{POST Job}} \text{API Gateway (TS)} \xrightarrow{\text{1. Create Record}} \text{Convex DB} \rightarrow \text{2. Publish Event} \xrightarrow{\text{Redis Streams}} \text{Worker Pool} \xrightarrow{\text{3. Process}} \text{File Storage (S3)} \xrightarrow{\text{4. Update Status}} \text{Convex DB} \leftarrow \text{Client Subscription}$$

---

## 🛠️ II. Technology Stack Breakdown

| Component               | Primary Tech                              | Purpose & Rationale                                                                                                                                               | Hosting Location                                 |
| :---------------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| **Client/API Gateway**  | $\text{TypeScript}$ / Next.js             | Handles HTTP requests, input validation, and client-side rendering logic (using Convex hooks). Minimal compute needed.                                            | **Vercel Edge Network**                          |
| **State Management**    | $\text{Convex}$                           | Provides real-time subscription models (crucial for UX) without requiring complex WebSocket server management. Centralizes job state.                             | **Managed Service (Convex)**                     |
| **Job Queue Broker**    | $\text{Redis Streams}$                    | The backbone of the async system. Workers consume jobs from this stream, guaranteeing delivery and allowing graceful failure handling.                            | **External Redis Instance**                      |
| **Worker Pool Cluster** | $\text{Go}$ or $\text{Node.js (w/ PM2)}$  | Executes the resource-intensive media logic. **This must be external.** Go is preferred here for superior concurrency management around I/O and subprocess calls. | **DigitalOcean Droplet / AWS ECS Fargate (VPS)** |
| **File Storage**        | $\text{AWS S3}$ or $\text{Cloudflare R2}$ | Stores the final, transcoded media files (`mp3`, `.mp4`). Workers upload artifacts here.                                                                          | **Object Storage Service**                       |

---

## ⚙️ III. Implementation Guide: Language Specifics & Contracts

### A. The TypeScript / Next.js Layer (Vercel)

- **API Route ($\text{/api/download}$):** Must validate the URL schema and required output parameters (`format`, `quality`).
  1.  Calls Convex's mutation API to initialize a new job record: `$jobId = convex.mutate(createJob, { url, ... })`.
  2.  Uses the returned $\text{`$jobId`}$ to construct the payload object.
  3.  Publishes the payload to Redis Stream: `redis.xadd('video_queue', jobId, payload)`.
- **Client Component:** Uses Convex's real-time hook: `const jobStatus = useQuery(getJobStatus, { jobId });` This automatically updates the UI when the worker changes the status in the database.

### B. The Go Worker Cluster (External VPS/Container)

Go is superior here because of its built-in concurrency primitives (`goroutines`) which make managing multiple subprocesses and network I/O very clean and performant under high load.

1.  **Worker Loop:** The primary function should contain a robust loop consuming the Redis Stream:

    ```go
    for {
        // 1. Block until message arrives from Redis Streams
        messages, err := redisClient.XReadGroup(...)
        if err != nil { /* Handle transient errors */ }

        for _, msg := range messages {
            jobID := msg["job_id"] // Read job ID from payload
            payload := msg["payload"]

            // 2. Update Status to PROCESSING in Convex (using external API call)
            convexClient.UpdateStatus(jobID, "PROCESSING", nil)

            // 3. Execute the heavy lifting in a separate goroutine for isolation
            go func(id string, data string) {
                if err := executeExtractionPipeline(id, data); err != nil {
                    // On failure, log extensively and update status to FAILED
                    convexClient.UpdateStatus(id, "FAILED", err.Error())
                    return
                }
                // 4. Final success steps
                s3Key := uploadToS3() // Upload transcoded file
                finalMetadata := buildFinalPayload(s3Key)
                convexClient.UpdateStatus(id, "COMPLETED", finalMetadata)

            }(jobID, payload)
        }
    }
    ```

2.  **Extraction Logic ($\text{executeExtractionPipeline}$):** This function must manage subprocesses using Go's `os/exec` package to call `yt-dlp` or `ffmpeg`. It needs robust error capture for standard output (`stdout`) and standard error (`stderr`).

---

## 🌐 IV. Hosting Strategy: Addressing the Vercel Limitation

You cannot run the Worker Pool on pure Vercel serverless functions due to timeout limits (usually $<15$ seconds) and memory constraints, which transcoding easily violates.

| Service                | Recommended Host Platform | Deployment Method              | Why?                                                   |
| :--------------------- | :------------------------ | :----------------------------- | :----------------------------------------------------- |
| **Client/API Gateway** | **Vercel**                | Next.js Build / Edge Functions | Perfect for stateless API endpoints and rapid frontend |
