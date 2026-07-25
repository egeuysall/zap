import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import {
  hashCliValue,
  normalizeCliParam,
  normalizeCliRedirect,
  randomCliValue,
} from "@/lib/server/cli-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const code = normalizeCliParam(body?.code);
  const codeVerifier = normalizeCliParam(body?.codeVerifier);
  const redirectUri = normalizeCliRedirect(body?.redirectUri);
  if (!code || !codeVerifier || !redirectUri) {
    return Response.json({ error: "Invalid CLI auth token request" }, { status: 400 });
  }

  const rawKey = `zak_${randomCliValue()}`;
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const result = await client.mutation(api.cliAuth.consumeCodeAndCreateApiKey, {
    codeHash: hashCliValue(code),
    codeChallenge: hashCliValue(codeVerifier),
    redirectUri,
    keyHash: hashCliValue(rawKey),
    prefix: "zak_",
    last4: rawKey.slice(-4),
    name: "CLI browser login",
  });
  if (!result) {
    return Response.json({ error: "CLI auth code expired or invalid" }, { status: 401 });
  }
  return Response.json({ apiKey: rawKey, authType: "clerk-browser" });
}
