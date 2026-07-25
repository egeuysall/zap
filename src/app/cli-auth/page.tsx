import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { normalizeCliParam, normalizeCliRedirect } from "@/lib/server/cli-auth";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect_uri?: string | string[];
    state?: string | string[];
    code_challenge?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const redirectUri = normalizeCliRedirect(first(params.redirect_uri));
  const state = normalizeCliParam(first(params.state));
  const codeChallenge = normalizeCliParam(first(params.code_challenge));

  if (!redirectUri || !state || !codeChallenge) {
    return <CliAuthMessage title="Invalid CLI login" body="Restart `zap login` from your terminal." />;
  }

  const current = `/cli-auth?${new URLSearchParams({
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
  })}`;
  if (!(await auth()).userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(current)}`);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0f0f0f] p-6 text-white">
      <form action="/api/cli-auth/authorize" method="post" className="w-full max-w-sm space-y-5 rounded-xl border border-[#303030] bg-[#212121] p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#aaa]">Zap CLI</p>
          <h1 className="text-xl font-semibold">Authorize terminal access</h1>
          <p className="text-sm leading-6 text-[#aaa]">Allow this terminal to submit remote downloads and save completed files to your Downloads folder.</p>
        </div>
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <Button type="submit" className="w-full bg-white text-black hover:bg-[#e5e5e5]">Authorize Zap CLI</Button>
      </form>
    </main>
  );
}

function CliAuthMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0f0f0f] p-6 text-white">
      <div className="w-full max-w-sm space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-[#aaa]">{body}</p>
      </div>
    </main>
  );
}
