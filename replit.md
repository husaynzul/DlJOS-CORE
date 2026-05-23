# DLJAIS — AI Action OS

An AI execution brain that lets you control your entire digital life through chat and voice. Natural language commands are converted into real-world actions across social media, trading, ads, e-commerce, and food ordering — with a mandatory approval step before anything executes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dljais run dev` — run the frontend (port 19665)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Drizzle ORM tables (conversations, messages, action_cards, platforms)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/dljais/src/` — React frontend
  - `pages/ChatPage.tsx` — Main chat interface
  - `pages/ActionsPage.tsx` — Action card history
  - `pages/PlatformsPage.tsx` — Platform connections
  - `pages/StatsPage.tsx` — Analytics dashboard
  - `pages/HistoryPage.tsx` — Conversation history
  - `components/ActionCard.tsx` — Approve/Reject/Modify action card UI
  - `components/AppLayout.tsx` — Sidebar + layout shell
  - `components/ThemeProvider.tsx` — Light/dark mode

## Architecture decisions

- **Approval-first design**: No action executes without explicit user approval. All AI responses that trigger an action generate an `ActionCard` in the DB with `status: pending`.
- **Intent classification**: Server-side keyword matching detects `social`, `trading`, `ads`, `ecommerce`, `food` intents from user messages and generates appropriate action cards.
- **Contract-first API**: OpenAPI spec gates all codegen; generated Zod schemas validate all server inputs and outputs.
- **Optimistic updates in chat**: User messages are shown immediately while the server processes; on error, input is restored.
- **Direct fetch for chat**: The chat page uses raw `fetch` (not generated hooks) to sequence conversation creation + message send atomically in a single flow.

## Product

- Unified chat interface (Claude-style, warm off-white, Inter font)
- Left sidebar: navigation, recent conversations, platform status dots
- Chat with AI that understands: social posts, trading orders, ad campaigns, food ordering
- Action cards appear inline in chat: Approve / Reject / Modify before any execution
- Platform management: 12 platforms across social, ads, trading, e-commerce, food, website
- Analytics dashboard: total actions, pending, completed, connected platforms
- Light/dark mode toggle

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always re-run `pnpm --filter @workspace/api-spec run codegen` before touching frontend or backend code
- `useSendMessage` hook from codegen takes `conversationId` as a parameter — must create conversation first if none exists
- The `pending-count` route must be registered BEFORE the `/:id` pattern in actions router, or Express will try to parse "pending-count" as an integer

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
