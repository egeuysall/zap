import { ZapShell } from "@/components/media/zap-shell";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return <ZapShell view="watch" videoId={videoId} />;
}
