"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, type DragEvent, type FormEvent, useEffect, useState } from "react";
import { Show, SignInButton, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Copy,
  Download,
  Menu,
  MoreVertical,
  PlayCircle,
  Plus,
  Search,
  SquarePlay,
  Trash2,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DownloadFormat, DownloadQuality } from "@/hooks/use-offline-queue";
import { type Job, type Video, type ZapView, useZapData } from "@/hooks/use-zap-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoPlayer } from "@/components/media/video-player";
import { cn } from "@/lib/utils";

type Props = {
  view: ZapView;
  query?: string;
  videoId?: string;
};

const nav: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/videos", label: "Videos", icon: SquarePlay },
];
const sidebarNav = [
  { label: "You", items: nav.filter((item) => item.href !== "/upload") },
  { label: "Create", items: nav.filter((item) => item.href === "/upload") },
];
const formats: DownloadFormat[] = ["mp4", "mp3"];
const qualities: DownloadQuality[] = ["best", "1080p", "720p", "480p", "audio"];
const cliInstallCommand = "curl -fsSL https://zap.egeuysal.com/install.sh | bash";

type YouTubeResult = {
  id: string;
  title: string;
  channel: string;
  duration: string | null;
  views: string | null;
  published: string | null;
  thumbnail: string | null;
  avatar: string | null;
  verified: boolean;
  url: string;
};

export function ZapShell(props: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const data = useZapData(props);
  const { user } = useUser();
  const [search, setSearch] = useState(props.query ?? "");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/videos?q=${encodeURIComponent(query)}` : "/videos");
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        className="bg-[#0f0f0f] text-white"
        style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "4.5rem" } as CSSProperties}
      >
        <AppSidebar pathname={pathname} />
        <SidebarInset className="min-w-0 bg-[#0f0f0f]">
          <Header search={search} setSearch={setSearch} submitSearch={submitSearch} />
          <div className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-7">
          <div className="mx-auto max-w-[1600px]">
            {props.view === "videos" && props.query?.trim() ? (
              <YouTubeResults key={props.query.trim()} query={props.query.trim()} />
            ) : data.status === "loading" ? (
              <SkeletonGrid />
            ) : props.view === "downloads" ? (
              <Downloads data={data} />
            ) : props.view === "upload" ? (
              <UploadView />
            ) : props.view === "watch" ? (
              <Watch video={data.selectedVideo} />
            ) : (
              <Videos videos={data.feed} signedIn={data.isSignedIn} userIcon={user?.imageUrl} />
            )}
          </div>
          </div>
          <MobileNav pathname={pathname} />
          <Toaster richColors theme="dark" />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function Header({
  search,
  setSearch,
  submitSearch,
}: {
  search: string;
  setSearch: (value: string) => void;
  submitSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-20 bg-[#0f0f0f]">
      <div className="flex h-14 items-center gap-3 px-4">
        <Button variant="ghost" size="icon" className="size-10 rounded-full hover:bg-[#272727] md:hidden" onClick={toggleSidebar} aria-label="Toggle sidebar"><Menu className="size-5" /></Button>
        <Brand className="md:hidden" />
        <form className="mx-auto hidden w-full max-w-[640px] md:flex" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="video-search">Search your videos</label>
          <div className="flex h-10 w-full overflow-hidden rounded-full border border-[#303030] bg-[#121212] focus-within:border-[#1c62b9] focus-within:bg-[#181818]">
            <Input id="video-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-full rounded-none !border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0" />
            <button type="submit" className="grid w-16 place-items-center border-l border-[#303030] bg-[#222] outline-none hover:bg-[#2b2b2b] focus-visible:bg-[#3f3f3f]" aria-label="Search"><Search className="size-5 stroke-[1.8]" /></button>
          </div>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/upload" className="hidden sm:block">
            <Button variant="secondary" className="h-9 rounded-full bg-[#272727] px-4 text-white hover:bg-[#3f3f3f]"><Plus className="size-5" />Create</Button>
          </Link>
          <Show when="signed-out">
            <SignInButton mode="modal"><Button variant="secondary" className="rounded-full bg-[#272727] text-white hover:bg-[#3f3f3f]">Sign in</Button></SignInButton>
          </Show>
          <Show when="signed-in"><UserButton /></Show>
        </div>
      </div>
      <form className="px-3 pb-3 md:hidden" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="mobile-video-search">Search your videos</label>
        <Input id="mobile-video-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-10 rounded-full border-[#303030] bg-[#121212] focus-visible:border-[#1c62b9] focus-visible:bg-[#181818] focus-visible:ring-0" />
      </form>
    </header>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/downloads" className={cn("flex min-w-max items-center", className)} aria-label="YouTube downloads">
      {/* Official YouTube dark wordmark, served from Google's immutable branding CDN. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://www.gstatic.com/youtube/img/branding/youtubelogo/svg/youtubelogo_dark.svg" alt="YouTube" width="90" height="20" className="h-5 w-[90px]" />
    </Link>
  );
}

function AppSidebar({ pathname }: { pathname: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Sidebar collapsible="icon" className="!border-0 bg-[#0f0f0f]">
      <SidebarHeader className="h-14 flex-row items-center gap-4 bg-[#0f0f0f] px-4 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-full hover:bg-[#272727]" onClick={toggleSidebar} aria-label="Toggle sidebar"><Menu className="size-5" /></Button>
        <Brand className="group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent className="bg-[#0f0f0f] group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:pt-3">
        {sidebarNav.map((group) => (
          <SidebarGroup key={group.label} className="px-3 py-3 group-data-[collapsible=icon]:p-0">
            <SidebarGroupLabel className="h-9 px-3 text-sm font-semibold text-white group-data-[collapsible=icon]:hidden">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} aria-label={item.label} />}
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                        className="h-10 gap-6 rounded-[10px] px-3 focus-visible:bg-[#272727] focus-visible:ring-0 data-active:bg-[#272727] hover:bg-[#272727] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5! [&_svg]:size-5 [&_svg]:stroke-[1.8]"
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

function Videos({ videos, signedIn, userIcon }: { videos: Video[]; signedIn: boolean; userIcon?: string }) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Your videos</h1>
        <p className="mt-1 text-sm text-[#aaa]">Downloads and uploads stored in Zap</p>
      </div>
      {videos.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {videos.map((video) => <VideoCard key={video.id} video={video} userIcon={userIcon} />)}
        </div>
      ) : (
        <EmptyState
          title={signedIn ? "No videos yet" : "Sign in to see your videos"}
          body={signedIn ? "Download a URL or upload a video to start your library." : "Your private downloads and uploads appear here."}
        />
      )}
    </section>
  );
}

function YouTubeResults({ query }: { query: string }) {
  const { getToken } = useAuth();
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueing, setQueueing] = useState<string | null>(null);
  const [queued, setQueued] = useState(() => new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    getToken()
      .then((token) => {
        if (!token) throw new Error("Authentication required");
        return fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      })
      .then(async (response) => {
        const body = await response.json() as { results?: YouTubeResult[]; error?: string };
        if (!response.ok) throw new Error(body.error || "YouTube search failed");
        setResults(body.results ?? []);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [getToken, query]);

  async function download(result: YouTubeResult) {
    setQueueing(result.id);
    setError(null);
    try {
      await createRemoteDownload(result.url, "mp4", "best", await getToken({ template: "convex" }));
      setQueued((current) => new Set(current).add(result.id));
      toast("Download queued", { description: "Waiting for a remote worker." });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setQueueing(null);
    }
  }

  if (loading) return <SkeletonGrid />;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">YouTube results</h1>
        <p className="mt-1 text-sm text-[#aaa]">{results.length} results for “{query}”</p>
      </div>
      {error ? <InlineError message={error} /> : null}
      {results.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {results.map((result) => (
            <article key={result.id} className="group">
              <a href={result.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-[#272727]">
                  {result.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.thumbnail} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center"><PlayCircle className="size-8 text-[#aaa]" /></div>
                  )}
                  {result.duration ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium">{result.duration}</span> : null}
                </div>
              </a>
              <div className="mt-3 grid grid-cols-[36px_minmax(0,1fr)_32px] items-start gap-3">
                <span className="grid size-9 overflow-hidden rounded-full bg-[#272727]">
                  {result.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs font-bold">{result.channel.slice(0, 1)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={result.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-[15px] font-semibold leading-5">{result.title}</a>
                  <p className="mt-1 flex items-center gap-1 truncate text-sm text-[#aaa]">
                    <span className="truncate">{result.channel}</span>
                    {result.verified ? <BadgeCheck className="size-4 shrink-0 fill-[#aaa] text-[#0f0f0f]" aria-label="Verified" /> : null}
                  </p>
                  <p className="text-sm text-[#aaa]">{[result.views, result.published].filter(Boolean).join(" · ")}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" className="rounded-full hover:bg-[#272727]" aria-label={`Actions for ${result.title}`} />}
                  >
                    <MoreVertical className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#282828] text-white">
                    <DropdownMenuItem
                      disabled={queueing === result.id || queued.has(result.id)}
                      onClick={() => void download(result)}
                    >
                      <Download className="size-4" />
                      {queued.has(result.id) ? "Queued" : queueing === result.id ? "Queueing…" : "Download"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No YouTube results" body="Try a different search." />
      )}
    </section>
  );
}

function VideoCard({ video, userIcon }: { video: Video; userIcon?: string }) {
  const removeVideo = useMutation(api.videos.remove);
  const setDuration = useMutation(api.videos.setDuration);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const youtubeThumbnail = video.sourceUrl ? youtubeThumbnailUrl(video.sourceUrl) : null;
  const captureDuration = (durationSeconds: number) => {
    if (!video.durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      void setDuration({ videoId: video.id as Id<"videos">, durationSeconds }).catch(() => undefined);
    }
  };

  async function deleteVideo() {
    setDeleting(true);
    try {
      await removeVideo({ videoId: video.id as Id<"videos"> });
      setConfirmDelete(false);
      toast("Video deleted");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <article className="group">
        <Link href={`/watch/${video.id}`} className="block">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-[#272727]">
            {video.thumbnail || youtubeThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail || youtubeThumbnail || ""} alt="" className="size-full object-cover" />
            ) : video.url ? (
              <video src={video.url} muted playsInline preload="metadata" onLoadedMetadata={(event) => captureDuration(event.currentTarget.duration)} className="size-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#202020] to-[#3f3f3f]"><PlayCircle className="size-8 text-[#aaa]" /></div>
            )}
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium">{video.duration}</span>
            {!video.durationSeconds && video.url && (video.thumbnail || youtubeThumbnail) ? (
              <video src={video.url} preload="metadata" onLoadedMetadata={(event) => captureDuration(event.currentTarget.duration)} className="hidden" />
            ) : null}
          </div>
        </Link>
        <div className="mt-3 grid grid-cols-[40px_1fr_32px] gap-3">
          <Avatar className="size-9 border-0 after:hidden">
            {userIcon ? <AvatarImage src={userIcon} alt="" /> : null}
            <AvatarFallback className="bg-[#272727] text-xs font-bold text-white">Z</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={`/watch/${video.id}`} className="line-clamp-2 text-sm font-semibold leading-5">{video.title}</Link>
            <p className="mt-1 text-sm text-[#aaa]">Zap · {video.source}</p>
            <p className="text-xs text-[#aaa]">{video.uploaded}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className="rounded-full hover:bg-[#272727]" aria-label={`Actions for ${video.title}`} />}
            >
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#282828] text-white">
              <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-red-300 focus:text-red-200">
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="rounded-xl bg-[#212121] text-white ring-0">
          <DialogHeader>
            <DialogTitle>Delete video?</DialogTitle>
            <DialogDescription className="text-[#aaa]">This permanently removes “{video.title}” and its stored file.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="rounded-full bg-white text-black hover:bg-[#e5e5e5]" disabled={deleting} onClick={() => void deleteVideo()}>{deleting ? "Deleting…" : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Downloads({ data }: { data: ReturnType<typeof useZapData> }) {
  const { getToken } = useAuth();
  const cancelJob = useMutation(api.downloads.cancel);
  const retryJob = useMutation(api.downloads.retry);
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp4");
  const [quality, setQuality] = useState<DownloadQuality>("best");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Id<"downloadJobs"> | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const invalid = validateDownloadUrl(url);
    if (invalid) return setError(invalid);
    setSubmitting(true);
    try {
      await createRemoteDownload(url.trim(), format, quality, await getToken({ template: "convex" }));
      setUrl("");
      toast("Download queued", { description: "Waiting for a remote worker." });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Downloads</h1>
          <p className="mt-1 text-sm text-[#aaa]">Processing runs remotely. The CLI saves completed files to <span className="font-medium text-white">~/Downloads</span>; website downloads use your browser&apos;s configured Downloads folder.</p>
          <div className="mt-4 flex max-w-2xl items-center gap-3 rounded-xl bg-[#212121] px-4 py-3">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm text-[#f1f1f1]">{cliInstallCommand}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full hover:bg-[#3f3f3f]"
              aria-label="Copy CLI install command"
              onClick={() => void navigator.clipboard.writeText(cliInstallCommand).then(
                () => toast("Install command copied"),
                () => toast.error("Could not copy install command"),
              )}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <Card className="rounded-xl bg-[#212121] text-white ring-0">
          <CardHeader><CardTitle>Download a video</CardTitle><CardDescription className="text-[#aaa]">Paste a YouTube video URL.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <label className="grid gap-2"><span className="text-sm font-medium">Video URL</span><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=…" className="h-10 rounded-xl !border-0 bg-[#121212] focus-visible:bg-[#181818] focus-visible:ring-0" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionSelect label="Format" value={format} onChange={(value) => {
                  const next = value as DownloadFormat;
                  setFormat(next);
                  if (next === "mp4" && quality === "audio") setQuality("best");
                }} options={formats} />
                <OptionSelect label="Quality" value={quality} onChange={(value) => setQuality(value as DownloadQuality)} options={format === "mp4" ? qualities.filter((option) => option !== "audio") : qualities} />
              </div>
              {error ? <InlineError message={error} /> : null}
              <Button type="submit" disabled={submitting} className="w-fit rounded-full bg-white text-black hover:bg-[#e5e5e5]"><Download className="size-4" />{submitting ? "Queueing…" : "Download"}</Button>
            </form>
          </CardContent>
        </Card>
        <div className="overflow-hidden rounded-xl bg-[#212121]">
          {data.jobs.length ? data.jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onDetails={() => setSelected(job.realId)}
              onCancel={job.status === "queued" || job.status === "running" ? async () => {
                const result = await cancelJob({ jobId: job.realId });
                if (result.cancelled) toast("Download cancelled");
                else toast.info(`Download is already ${result.state}`);
              } : undefined}
              onRetry={job.status === "failed" ? async () => {
                try {
                  await retryJob({ jobId: job.realId });
                  toast("Download queued", { description: "Retrying with a storage-friendly quality." });
                } catch (caught) {
                  toast.error(errorMessage(caught));
                }
              } : undefined}
            />
          )) : <EmptyState title="No remote downloads" body="Paste a URL above to start one." />}
        </div>
      </div>
      <aside className="space-y-3">
        <Metric label="Ready" value={data.videos.filter((video) => video.source === "download").length} detail="stored videos" />
        <Metric label="Processing" value={data.jobs.filter((job) => job.status === "running").length} detail="active downloads" />
        <Metric label="Queued" value={data.jobs.filter((job) => job.status === "queued").length} detail="waiting for worker" />
      </aside>
      <DownloadDialog jobId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function JobRow({ job, onDetails, onCancel, onRetry }: { job: Job; onDetails: () => void; onCancel?: () => void; onRetry?: () => void }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px_auto] md:items-center">
      <button type="button" onClick={onDetails} className="min-w-0 text-left"><p className="truncate text-sm font-semibold">{job.title}</p><p className="mt-1 text-xs text-[#aaa]">{job.format.toUpperCase()} · {job.quality} · {job.updatedAt}</p></button>
      {job.status === "running" ? (
        <div className="space-y-1">
          <Progress value={job.progress} className="bg-[#3f3f3f] [&_[data-slot=progress-indicator]]:bg-[#ff0033]" />
          <p className="text-right text-xs tabular-nums text-[#aaa]">{Math.round(job.progress)}%</p>
        </div>
      ) : (
        <p className="text-xs text-[#aaa]">{job.status === "queued" ? "Waiting for remote worker" : ""}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#272727] px-2 py-1 text-xs">{job.status}</span>
        {job.status === "complete" ? <a href={`/api/download/${job.realId}/file`} className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-black hover:bg-[#e5e5e5]"><Download className="size-4" />File</a> : null}
        {onRetry ? <Button size="sm" variant="ghost" className="rounded-full" onClick={onRetry}>Retry</Button> : null}
        {onCancel ? <Button size="sm" variant="ghost" className="rounded-full" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </div>
  );
}

function DownloadDialog({ jobId, onClose }: { jobId: Id<"downloadJobs"> | null; onClose: () => void }) {
  const job = useQuery(api.downloads.getMine, jobId ? { jobId } : "skip");
  return (
    <Dialog open={Boolean(jobId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-xl bg-[#212121] text-white ring-0">
        <DialogHeader><DialogTitle>Download details</DialogTitle><DialogDescription className="text-[#aaa]">Live state from the remote worker.</DialogDescription></DialogHeader>
        {!job ? <Skeleton className="h-24" /> : <div className="space-y-3 text-sm"><p className="break-all font-medium">{job.title || job.url}</p>{job.state === "processing" || job.state === "completed" ? <Progress value={job.state === "completed" ? 100 : job.progress ?? 0} className="[&_[data-slot=progress-indicator]]:bg-[#ff0033]" /> : null}<p className="text-[#aaa]">{job.state === "queued" ? "Waiting for a remote worker to pick this up." : `${job.state} · ${job.format} · ${job.quality}`}</p>{job.error ? <InlineError message={job.error} /> : null}</div>}
      </DialogContent>
    </Dialog>
  );
}

function UploadView() {
  const { isAuthenticated: isSignedIn } = useConvexAuth();
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createUpload = useMutation(api.videos.createNativeUpload);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  function chooseFile(next: File | null) {
    setDragging(false);
    setError(null);
    if (next && !next.type.startsWith("video/")) {
      setFile(null);
      setError("Choose a video file.");
      return;
    }
    setFile(next);
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0] ?? null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSignedIn) return setError("Sign in before uploading.");
    if (!file?.type.startsWith("video/")) return setError("Choose a video file.");
    if (title.trim().length < 3) return setError("Title must be at least 3 characters.");
    setSubmitting(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadFile(uploadUrl, file, setProgress);
      const thumbnail = await createVideoThumbnail(file);
      const thumbnailUploadUrl = await generateUploadUrl();
      const thumbnailStorageId = await uploadFile(thumbnailUploadUrl, thumbnail.file, () => undefined);
      await createUpload({ title: title.trim(), description: description.trim() || undefined, storageId, thumbnailStorageId, contentType: file.type, durationSeconds: thumbnail.durationSeconds, sizeBytes: file.size });
      setTitle("");
      setDescription("");
      setFile(null);
      setProgress(100);
      toast.success("Video uploaded");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div><h1 className="text-2xl font-bold">Upload</h1><p className="mt-1 text-sm text-[#aaa]">Add a video to your private Zap library.</p></div>
      <Card className="rounded-xl bg-[#212121] text-white ring-0">
        <CardContent className="p-5 sm:p-6">
          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Video title" className="h-10 rounded-xl !border-0 bg-[#121212] focus-visible:bg-[#181818] focus-visible:ring-0" /></label>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Description</span><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="min-h-20 rounded-xl !border-0 bg-[#121212] focus-visible:bg-[#181818] focus-visible:ring-0" /></label>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Video file</span>
              <label
                htmlFor="video-file"
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={dropFile}
                className={cn(
                  "flex min-h-28 cursor-pointer items-center gap-4 rounded-xl bg-[#181818] px-5 transition-colors hover:bg-[#272727] focus-within:bg-[#272727]",
                  dragging && "bg-[#272727]",
                )}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#303030]"><Upload className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{file?.name ?? (dragging ? "Drop video here" : "Choose a video or drag it here")}</span>
                  <span className="mt-0.5 block text-xs text-[#aaa]">{file ? `${(file.size / 1_048_576).toFixed(1)} MB · Click to replace` : "MP4, WebM, MOV, or another video format"}</span>
                </span>
                <Input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {progress > 0 ? <Progress value={progress} className="[&_[data-slot=progress-indicator]]:bg-[#ff0033]" /> : null}
            {error ? <InlineError message={error} /> : null}
            {isSignedIn ? <Button type="submit" disabled={submitting} className="w-fit rounded-full bg-white text-black hover:bg-[#e5e5e5]"><Upload className="size-4" />{submitting ? "Uploading…" : "Upload"}</Button> : <SignInButton mode="modal"><Button type="button" className="w-fit rounded-full bg-white text-black hover:bg-[#e5e5e5]">Sign in to upload</Button></SignInButton>}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

function Watch({ video }: { video: Video | null }) {
  if (!video?.url) return <EmptyState title="Video not found" body="This video is unavailable or does not belong to your account." />;
  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <VideoPlayer src={video.url} title={video.title} />
      <div><h1 className="text-xl font-bold">{video.title}</h1><p className="mt-1 text-sm text-[#aaa]">{video.source} · {video.uploaded}</p></div>
      <Card className="rounded-xl bg-[#272727] text-white ring-0"><CardContent className="py-4 text-sm leading-6">{video.description}</CardContent></Card>
    </section>
  );
}

function OptionSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  const items = options.map((option) => ({ label: option, value: option }));
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><Select items={items} value={value} onValueChange={(next) => next && onChange(next)}><SelectTrigger className="h-10 w-full rounded-xl !border-0 bg-[#121212] focus-visible:bg-[#181818] focus-visible:ring-0"><SelectValue /></SelectTrigger><SelectContent className="ring-0"><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></label>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <Card className="rounded-xl bg-[#212121] text-white ring-0"><CardHeader><CardDescription className="text-[#aaa]">{label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle><CardDescription className="text-[#aaa]">{detail}</CardDescription></CardHeader></Card>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="grid min-h-64 place-items-center rounded-xl bg-[#212121] p-8 text-center"><div><PlayCircle className="mx-auto size-8 text-[#aaa]" /><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mt-2 text-sm text-[#aaa]">{body}</p></div></div>;
}

function InlineError({ message }: { message: string }) {
  return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{message}</p>;
}

function SkeletonGrid() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="space-y-3"><Skeleton className="aspect-video rounded-xl bg-[#272727]" /><Skeleton className="h-4 w-4/5 bg-[#272727]" /></div>)}</div>;
}

function MobileNav({ pathname }: { pathname: string }) {
  return <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 bg-[#0f0f0f]/95 backdrop-blur md:hidden">{nav.map((item) => { const Icon = item.icon; const active = pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", active && "font-semibold text-white")}><Icon className={cn("size-[18px]", !active && "text-[#aaa]")} />{item.label}</Link>; })}</nav>;
}

function validateDownloadUrl(value: string) {
  if (!value.trim()) return "URL is required.";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "URL must use HTTP or HTTPS.";
    if (url.username || url.password) return "URL credentials are not allowed.";
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!isYouTubeHost(host)) return "Enter a YouTube video URL.";
  } catch {
    return "Enter a valid URL.";
  }
  return null;
}

function youtubeThumbnailUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
    return id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

async function createVideoThumbnail(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";
  video.src = url;
  try {
    await once(video, "loadedmetadata");
    video.currentTime = Math.min(1, Math.max(0, video.duration / 3));
    await once(video, "seeked");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = Math.max(1, Math.round(640 * video.videoHeight / video.videoWidth));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((thumbnail) => thumbnail ? resolve(thumbnail) : reject(new Error("Unable to generate thumbnail")), "image/jpeg", 0.82),
    );
    return {
      file: new File([blob], "thumbnail.jpg", { type: "image/jpeg" }),
      durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function once(target: HTMLMediaElement, event: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener("error", () => reject(new Error("Unable to read video metadata")), { once: true });
  });
}

function isYouTubeHost(host: string) {
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
}

async function uploadFile(uploadUrl: string, file: File, onProgress: (value: number) => void) {
  return await new Promise<Id<"_storage">>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 95));
    request.onerror = () => reject(new Error("Upload connection failed"));
    request.onload = () => {
      try {
        const response = JSON.parse(request.responseText) as { storageId?: Id<"_storage"> };
        if (request.status < 200 || request.status >= 300 || !response.storageId) throw new Error("Upload failed");
        resolve(response.storageId);
      } catch (error) {
        reject(error);
      }
    };
    request.send(file);
  });
}

async function createRemoteDownload(
  url: string,
  format: DownloadFormat,
  quality: DownloadQuality,
  token: string | null,
) {
  if (!token) throw new Error("Authentication required");
  const response = await fetch("/api/download", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url, format, quality }),
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Unable to queue download");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
