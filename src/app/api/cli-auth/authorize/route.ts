import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import {
  CLI_AUTH_TTL_MS,
  hashCliValue,
  normalizeCliParam,
  normalizeCliRedirect,
  randomCliValue,
} from "@/lib/server/cli-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await auth();
  const token = await session.getToken({ template: "convex" });
  if (!session.userId || !token) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const redirectUri = normalizeCliRedirect(form?.get("redirect_uri"));
  const state = normalizeCliParam(form?.get("state"));
  const codeChallenge = normalizeCliParam(form?.get("code_challenge"));
  if (!redirectUri || !state || !codeChallenge) {
    return Response.json({ error: "Invalid CLI auth request" }, { status: 400 });
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  const code = randomCliValue();
  await client.mutation(api.cliAuth.createCode, {
    codeHash: hashCliValue(code),
    codeChallenge,
    redirectUri,
    state,
    expiresAt: Date.now() + CLI_AUTH_TTL_MS,
  });
  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);
  return Response.redirect(callback, 303);
}
