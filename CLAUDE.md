# WhatsApp Auto-Reply & Blasting Tool

## Project Overview
A WhatsApp-like web UI for managing auto-replies and bulk messaging on a real (non-API) WhatsApp business account. n8n handles the chatbot/RAG logic; Baileys handles the WhatsApp connection.

## Architecture

```
[WhatsApp] ←→ [Baileys Backend — Railway]
                        ↕ REST API (API_KEY auth)
              [Next.js Frontend — Cloudflare Pages]
                        ↕
                   [Supabase — DB + Realtime]
                        ↕
              [Self-hosted n8n — webhook]
```

### Inbound message flow:
1. Message arrives at Baileys → saved to Supabase `messages` table
2. Frontend updates via Supabase Realtime
3. If `global_auto_reply=true` AND `chats.auto_reply_enabled=true`: backend fetches last `CHAT_HISTORY_LIMIT` messages, POSTs to `N8N_WEBHOOK_URL`
4. n8n replies → calls `POST /api/send` on backend → Baileys sends → saved to Supabase

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Node.js 20, TypeScript, Express, `@whiskeysockets/baileys` |
| Database | Supabase (Postgres + Realtime) |
| Frontend hosting | Cloudflare Pages (with `@cloudflare/next-on-pages`) |
| Backend hosting | Railway (persistent Node.js process) |
| Automation | Self-hosted n8n |

## Monorepo Structure

```
/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── setup/             # QR code scan page
│   │   ├── chat/[chatId]/     # Message thread
│   │   ├── blast/             # Blast campaigns
│   │   ├── contacts/          # Contact management
│   │   └── settings/          # Global settings
│   ├── components/
│   └── .env.local             # Copy from root .env (NEXT_PUBLIC_ vars only)
├── backend/                   # Express + Baileys
│   ├── src/
│   │   ├── whatsapp/          # Baileys connection + message handlers
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # blastQueue, n8nBridge, supabase client
│   │   └── middleware/        # API key auth
│   └── .env                   # Copy from root .env (backend vars)
├── supabase/
│   └── migrations/
│       └── 001_init.sql       # Full schema
├── .env                       # All keys — DO NOT COMMIT
├── .env.example               # Key names only — safe to commit
└── CLAUDE.md
```

## Key Conventions

- **API auth**: All requests between frontend ↔ backend and n8n ↔ backend use `Authorization: Bearer <API_KEY>` header
- **WhatsApp JIDs**: Chat IDs are WhatsApp JIDs (e.g. `6512345678@s.whatsapp.net`). Phone numbers stored as E.164 (e.g. `+6512345678`)
- **Baileys auth state**: Persisted in Supabase `settings` table under key `baileys_auth_state` (JSON). This survives Railway restarts
- **Realtime**: Frontend subscribes to Supabase Realtime on `messages` INSERT and `chats` UPDATE — no polling
- **Blast rate limiting**: 1 message per `BLAST_INTERVAL_MS` (default 120000ms = 2 min). Enforced by `setInterval` in `blastQueue.ts`
- **Chat history for n8n**: Backend fetches last `CHAT_HISTORY_LIMIT` (default 20) messages and includes them in the n8n webhook payload as `history: [{ direction, body, timestamp }]`

## n8n Integration

### Inbound webhook (backend → n8n):
```
POST N8N_WEBHOOK_URL
Authorization: Bearer <API_KEY>
{
  "chatId": "6512345678@s.whatsapp.net",
  "from": "+6512345678",
  "message": "User message text",
  "timestamp": "ISO8601",
  "history": [{ "direction": "inbound|outbound", "body": "...", "timestamp": "..." }]
}
```

### Reply webhook (n8n → backend):
```
POST /api/send
Authorization: Bearer <API_KEY>
{ "chatId": "6512345678@s.whatsapp.net", "message": "AI reply text" }
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `chats` | One row per WhatsApp contact/group. Has `auto_reply_enabled` flag |
| `messages` | All messages (inbound + outbound). Foreign key to `chats` |
| `settings` | Key-value store. Holds `global_auto_reply` and `baileys_auth_state` |
| `contacts` | Contact list for blast campaigns |
| `message_templates` | Reusable templates with `{{name}}`, `{{phone}}` placeholders |
| `blast_campaigns` | Blast jobs with status tracking |
| `blast_recipients` | Per-contact send status for each campaign |

## Environment Variables

See `.env.example` for all required keys. Never commit `.env`.
