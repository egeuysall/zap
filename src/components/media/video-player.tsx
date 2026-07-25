"use client";

import { useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VideoPlayer({ src, title }: { src: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  function togglePlay() {
    if (!video.current) return;
    if (video.current.paused) void video.current.play();
    else video.current.pause();
  }

  return (
    <div ref={container} className="group relative aspect-video overflow-hidden rounded-xl bg-black">
      <video
        ref={video}
        src={src}
        className="h-full w-full"
        playsInline
        preload="metadata"
        aria-label={title}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <button
        type="button"
        aria-label={playing ? "Pause video" : "Play video"}
        onClick={togglePlay}
        className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/10"
      >
        {!playing ? (
          <span className="grid size-16 place-items-center rounded-full bg-black/70">
            <Play className="ml-1 size-8 fill-white text-white" />
          </span>
        ) : null}
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-10 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(event) => {
            if (video.current) video.current.currentTime = Number(event.target.value);
          }}
          aria-label="Video position"
          className="h-1 w-full accent-[#ff0033]"
        />
        <div className="mt-1 flex items-center gap-1 text-white">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} className="hover:bg-white/15">
            {playing ? <Pause className="size-5 fill-white" /> : <Play className="size-5 fill-white" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              if (!video.current) return;
              video.current.muted = !video.current.muted;
              setMuted(video.current.muted);
            }}
            className="hover:bg-white/15"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
          <span className="text-xs tabular-nums">{time(current)} / {time(duration)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Full screen"
            onClick={() => void container.current?.requestFullscreen().catch(() => undefined)}
            className="ml-auto hover:bg-white/15"
          >
            <Maximize className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function time(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
