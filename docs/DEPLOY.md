# Production deployment

The Vite dev server is fine for `npm run dev`. For shared hosting you need a runtime that keeps the Groq API key server-side (never bundled into the browser).

## Architecture

```
[browser] --SSE--> [your hosted Vite middleware / Node server] --HTTPS--> Groq
```

The four proxies in `vite.config.ts` (`/api/npc-chat`, `/api/npc-reflect`, `/api/npc-beat`, `/api/npc-talk`) must run on your server, not in the browser bundle.

## Path A: Vercel / Netlify Functions (recommended)

1. Port each Vite middleware to an equivalent serverless function (e.g. `api/npc-chat.ts` exporting a default handler that takes `Request` → SSE `Response`).
2. The frontend already calls `/api/npc-chat` etc., so URLs stay identical.
3. Build the static frontend with `npm run build` and deploy `dist/` to the static host.
4. Add `GROQ_API_KEY` as a project secret. Never commit.

Sample Vercel function sketch:
```ts
// api/npc-chat.ts
export const config = { runtime: 'edge' };
export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const payload = await req.json();
  // ... port the body of npcChatPlugin from vite.config.ts here ...
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

## Path B: Self-hosted Node server

```bash
npm run build
node server.js   # write Express/Hono/Fastify mirroring the Vite proxies
```

`server.js` should:
- Serve `dist/` statically.
- Mount the same `/api/*` proxies (port helpers out of `vite.config.ts`).
- Read `GROQ_API_KEY` from `process.env`.

## Env vars

| Var | Required | Default |
|-----|----------|---------|
| `GROQ_API_KEY` | yes | — |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` |
| `REPLICATE_API_TOKEN` | no | — (only for `tools/gen-vox-ai.mjs`) |

## Domain + HTTPS

Vercel/Netlify give you HTTPS automatically. If self-hosting, terminate TLS via Caddy / Cloudflare. SSE requires HTTPS in modern browsers.

## CI

`.github/workflows/ci.yml` runs `tsc --noEmit`, `npm test`, and `vite build` on every push to `main` and every PR. Build artifacts are uploaded for 7 days so reviewers can preview without local install.

## Status

The dev path (`npm run dev` + `.env`) is exercised manually. The Vercel/Netlify function port is documented but not yet wired.
