import type {
  CompletionEvent,
  DownloadJob,
  FailureEvent,
  ProgressEvent,
} from "./types";

export type WorkerQueue = {
  lease(workerId: string): Promise<DownloadJob | null>;
  progress(event: ProgressEvent): Promise<{ cancel?: boolean }>;
  complete(event: CompletionEvent): Promise<void>;
  fail(event: FailureEvent): Promise<void>;
  getUploadUrl?(jobId: string, filename: string, contentType: string): Promise<string>;
};
