import { ZapShell } from "@/components/media/zap-shell";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return <ZapShell view="videos" query={q} />;
}
