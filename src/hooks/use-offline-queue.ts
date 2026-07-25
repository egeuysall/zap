"use client";

import { useCallback, useEffect, useState } from "react";

export type DownloadFormat = "mp4" | "mp3";
export type DownloadQuality = "best" | "1080p" | "720p" | "480p" | "audio";
type QueueKind = "download" | "upload";

export type QueueItem = {
  id: string;
  kind: QueueKind;
  title: string;
  status: "queued" | "ready";
  createdAt: number;
  url?: string;
  format?: DownloadFormat;
  quality?: DownloadQuality;
};

const dbName = "zap-offline-queue";
const storeName = "queue";

function openQueueDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function isQueueItem(value: unknown): value is QueueItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QueueItem>;
  return (
    typeof item.id === "string" &&
    (item.kind === "download" || item.kind === "upload") &&
    typeof item.title === "string" &&
    (item.status === "queued" || item.status === "ready") &&
    typeof item.createdAt === "number" &&
    (item.url === undefined || typeof item.url === "string") &&
    (item.format === undefined || item.format === "mp4" || item.format === "mp3") &&
    (item.quality === undefined ||
      item.quality === "best" ||
      item.quality === "1080p" ||
      item.quality === "720p" ||
      item.quality === "480p" ||
      item.quality === "audio")
  );
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openQueueDb();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(storeName, mode).objectStore(storeName));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  }).finally(() => db.close());
}

async function readItems() {
  const result = await withStore("readonly", (store) => store.getAll());
  return Array.isArray(result) ? result.filter(isQueueItem) : [];
}

async function writeItem(item: QueueItem) {
  await withStore("readwrite", (store) => store.put(item));
}

async function deleteItem(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
}

export function useOfflineQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(() =>
    typeof window !== "undefined" && !("indexedDB" in window)
      ? "Offline queue is not available in this browser."
      : null,
  );

  useEffect(() => {
    if (!("indexedDB" in window)) return;

    readItems()
      .then((stored) =>
        setItems(stored.sort((a, b) => b.createdAt - a.createdAt)),
      )
      .catch(() => setError("Offline queue is using memory for this session."));
  }, []);

  const enqueue = useCallback(async (item: Omit<QueueItem, "id" | "createdAt" | "status">) => {
    const queued: QueueItem = {
      ...item,
      id: `${item.kind}-${Date.now()}`,
      title: item.title.trim() || `Untitled ${item.kind}`,
      status: "queued",
      createdAt: Date.now(),
    };

    setItems((current) => [queued, ...current]);

    if (!("indexedDB" in window)) return queued;

    try {
      await writeItem(queued);
    } catch {
      setError("Offline queue is using memory for this session.");
    }

    return queued;
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (!("indexedDB" in window)) return;
    try {
      await deleteItem(id);
    } catch {
      setError("Offline queue could not remove that item.");
    }
  }, []);

  return {
    items,
    error,
    enqueue,
    enqueueDownload: (
      title: string,
      url: string,
      format: DownloadFormat,
      quality: DownloadQuality,
    ) => enqueue({ kind: "download", title, url, format, quality }),
    enqueueUpload: (title: string) => enqueue({ kind: "upload", title }),
    remove,
  };
}
