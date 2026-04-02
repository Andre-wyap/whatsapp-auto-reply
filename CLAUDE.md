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
| `contacts` | Contact list — `id`, `name`, `phone` (unique E.164), `remark`. No tags, no status |
| `contact_groups` | Product/category groups — `id`, `name`, `sheet_url`, `description` |
| `contact_group_members` | Many-to-many join — `contact_id`, `group_id`, `status` (composite PK) |
| `message_templates` | Reusable templates with `{{name}}`, `{{phone}}` placeholders |
| `blast_campaigns` | Blast jobs with status tracking |
| `blast_recipients` | Per-contact send status for each campaign |

## Contact Groups & Status System

### Design decisions
- Contacts can belong to **multiple groups** (e.g. same person in "Product A" and "Product B" lists)
- **Status is per-group-membership**, not per-contact — stored on `contact_group_members.status`
  - Same person can be "Follow up" in Product A group and "Closed" in Product B group
- **Statuses are dynamic** — no hardcoded list. Derived from `SELECT DISTINCT status FROM contact_group_members WHERE group_id = ?`
  - New statuses appear automatically when synced from sheets
- **Tags removed** — hierarchy is Contact Group → Status
- **Single n8n sync webhook** (`N8N_CONTACT_SYNC_URL`) handles all groups. Backend passes `{ sheetUrl, groupId }` so n8n knows which sheet to read

### Contact Group sync flow
1. User creates a group, pastes Google Sheet URL into `contact_groups.sheet_url`
2. User clicks Sync on a group → backend POSTs to `N8N_CONTACT_SYNC_URL`:
   ```json
   { "sheetUrl": "https://docs.google.com/...", "groupId": "uuid" }
   ```
3. n8n reads that sheet, loops each row, calls `POST /api/contacts` per row:
   ```json
   { "name": "John", "phone": "+6512345678", "groupId": "uuid", "status": "Send quote" }
   ```
4. Backend upserts contact by phone, upserts membership row with status

### Contact Group API routes
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/contact-groups` | List all groups |
| POST | `/api/contact-groups` | Create group (name, sheet_url) |
| PUT | `/api/contact-groups/:id` | Edit group |
| DELETE | `/api/contact-groups/:id` | Delete group |
| POST | `/api/contact-groups/:id/sync` | Trigger n8n sync for this group |
| DELETE | `/api/contact-groups/:id/members/:contactId` | Remove contact from group |

### Blast filter chain
Group → Status (auto-loaded from that group's members) → Contacts pre-selected

### n8n changes required
The contact sync workflow must:
1. Accept `sheetUrl` dynamically from webhook body (not hardcoded)
2. Accept `groupId` from webhook body
3. Pass both `groupId` and `status` when calling `POST /api/contacts` per row

## Environment Variables

See `.env.example` for all required keys. Never commit `.env`.
