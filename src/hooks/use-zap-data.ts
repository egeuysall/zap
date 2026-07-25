"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export type ZapView = "downloads" | "upload" | "videos" | "watch";

export type Video = {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  duration: string;
  durationSeconds: number | null;
  uploaded: string;
  source: "upload" | "download";
  sourceUrl: string | null;
  url: string | null;
};

export type Job = {
  id: string;
  realId: Id<"downloadJobs">;
  title: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  progress: number;
  format: "mp4" | "mp3";
  quality: "best" | "1080p" | "720p" | "480p" | "audio";
  updatedAt: string;
  error?: string;
};

type OwnedVideo = Doc<"videos"> & {
  url: string | null;
  thumbnailUrl: string | null;
};

export function useZapData(options: {
  view: ZapView;
  query?: string;
  videoId?: string;
}) {
  const clerk = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const syncProfile = useMutation(api.profiles.sync);
  const ownedVideos = useQuery(
    api.videos.listMine,
    isAuthenticated ? { limit: 50 } : "skip",
  );
  const ownedJobs = useQuery(
    api.downloads.listMine,
    isAuthenticated ? { limit: 50 } : "skip",
  );
  const selectedOwnedVideo = useQuery(
    api.videos.getMine,
    isAuthenticated && options.videoId
      ? { videoId: options.videoId as Id<"videos"> }
      : "skip",
  );

  useEffect(() => {
    if (isAuthenticated) void syncProfile().catch(() => undefined);
  }, [isAuthenticated, syncProfile]);

  return useMemo(() => {
    const videos = (ownedVideos ?? []).map(mapVideo);
    const query = options.query?.trim().toLowerCase() ?? "";
    return {
      status:
        !clerk.isLoaded || isLoading || (isAuthenticated && (!ownedVideos || !ownedJobs))
          ? ("loading" as const)
          : ("ready" as const),
      isSignedIn: Boolean(clerk.isSignedIn),
      videos,
      feed: query
        ? videos.filter((video) =>
            [video.title, video.description, video.source].some((value) =>
              value.toLowerCase().includes(query),
            ),
          )
        : videos,
      selectedVideo: selectedOwnedVideo ? mapVideo(selectedOwnedVideo) : null,
      jobs: (ownedJobs ?? []).map(mapJob),
      query,
    };
  }, [clerk.isLoaded, clerk.isSignedIn, isAuthenticated, isLoading, options.query, ownedJobs, ownedVideos, selectedOwnedVideo]);
}

function mapVideo(video: OwnedVideo): Video {
  return {
    id: video._id,
    title: video.source === "download" ? readableDownloadTitle(video.title) : video.title || "Untitled video",
    description: video.description ?? "Stored in your private Zap library.",
    thumbnail: video.thumbnailUrl,
    duration: video.durationSeconds ? formatDuration(video.durationSeconds) : "0:00",
    durationSeconds: video.durationSeconds ?? null,
    uploaded: relativeTime(video.createdAt),
    source: video.source,
    sourceUrl: video.sourceUrl ?? null,
    url: video.url,
  };
}

function mapJob(job: Doc<"downloadJobs">): Job {
  return {
    id: job._id,
    realId: job._id,
    title: job.title ? readableDownloadTitle(job.title) : job.url,
    status:
      job.state === "processing"
        ? "running"
        : job.state === "completed"
          ? "complete"
          : job.state,
    progress: job.state === "completed" ? 100 : job.progress ?? 0,
    format: job.format,
    quality: job.quality,
    updatedAt: relativeTime(job.updatedAt),
    error: job.error,
  };
}

function readableDownloadTitle(title: string) {
  return title.replace(/_+/g, " ").trim();
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
