export type OutputKind = "audio" | "video";
export type OutputFormat = "mp3" | "m4a" | "wav" | "mp4" | "webm";
export type DownloadQuality = "best" | "1080p" | "720p" | "480p" | "audio";

export type DownloadJob = {
  id: string;
  url: string;
  kind?: OutputKind;
  format?: OutputFormat;
  quality?: DownloadQuality;
  uploadUrl?: string;
  filename?: string;
};

export type LeaseResponse = DownloadJob | null;

export type ProgressEvent = {
  jobId: string;
  status: "leased" | "downloading" | "processing" | "uploading";
  progress?: number;
  message?: string;
};

export type CompletionEvent = {
  jobId: string;
  storageId?: string;
  artifact?: unknown;
  filename: string;
  contentType: string;
  bytes: number;
  durationSeconds: number;
};

export type FailureEvent = {
  jobId: string;
  error: string;
  retryable: boolean;
};
