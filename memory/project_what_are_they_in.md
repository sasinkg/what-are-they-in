---
name: what-are-they-in project context
description: Core tech stack, architecture decisions, and setup details for the what-are-they-in app
type: project
---

Actor/show connection graph web app — tracks actors across shows and visualizes connections.

**Stack:**
- Next.js 16.2.2 (App Router, Turbopack) — uses `proxy.ts` not `middleware.ts` (Next 16 renamed it), export must be named `proxy`
- TypeScript + Tailwind CSS
- PostgreSQL via Neon (hosted) — connection string in `.env` and `.env.local`
- Prisma 7 with `@prisma/adapter-pg` — Prisma 7 requires a database adapter (WASM engine), `PrismaClient` from `@prisma/client` takes `{ adapter }` not just `{ log }`
- NextAuth v5 (beta) — split config: `auth.config.ts` (edge-safe, no Node.js imports) + `auth.ts` (full, with adapter + providers). Google OAuth + email/password credentials.
- TMDB API for actor/show search — uses Bearer token auth
- react-force-graph-2d for graph visualization

**Auth split pattern (Next 16 + NextAuth v5):**
- `src/auth.config.ts` — edge-safe config, `authorized` callback, no providers
- `src/auth.ts` — full config, imports prisma/bcryptjs/Google, spreads authConfig
- `src/proxy.ts` — imports NextAuth(authConfig), exports `proxy` function

**Prisma 7 quirks:**
- `datasource db` in schema.prisma has NO `url` field — url goes in `prisma.config.ts`
- `prisma.config.ts` reads DATABASE_URL via dotenv/config
- Client needs pg adapter: `new PrismaClient({ adapter: new PrismaPg(pool) })`
- Generated client goes to `node_modules/@prisma/client` with `provider = "prisma-client-js"`

**Key files:**
- `src/lib/prisma.ts` — singleton Prisma client with pg adapter
- `src/components/GraphView.tsx` — main graph UI (force-graph, search highlight, node panel)
- `src/components/AddEntrySheet.tsx` — 3-step bottom sheet: person → show → role
- `src/app/api/entries/route.ts` — GET/POST entries
- `src/app/api/tmdb/search/route.ts` — TMDB search proxy
- `src/app/api/tmdb/person/[id]/route.ts` — actor details + credits

**Why:** User wants to remember which shows actors appear in, visualize connections between shows through shared cast members.

**How to apply:** When modifying auth, use the split config pattern. When touching Prisma, remember the adapter requirement. Next.js middleware = proxy.ts with `proxy` export.
