-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CONTACTS
-- ============================================================
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null unique,  -- E.164 format e.g. +6512345678
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- CHATS (one row per WhatsApp JID)
-- ============================================================
create table chats (
  id text primary key,  -- WhatsApp JID e.g. 6512345678@s.whatsapp.net
  name text,
  phone text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer default 0,
  auto_reply_enabled boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id text not null references chats(id) on delete cascade,
  wa_message_id text,            -- WhatsApp's own message ID (for dedup)
  body text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
  timestamp timestamptz default now()
);

create index messages_chat_id_timestamp_idx on messages(chat_id, timestamp desc);

-- ============================================================
-- SETTINGS (key-value store)
-- ============================================================
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Seed default settings
insert into settings (key, value) values
  ('global_auto_reply', 'true'),
  ('baileys_auth_state', '{}');   -- Populated by backend on first WhatsApp connect

-- ============================================================
-- MESSAGE TEMPLATES (for blasting)
-- ============================================================
create table message_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  body text not null,  -- Supports {{name}}, {{phone}} placeholders
  created_at timestamptz default now()
);

-- ============================================================
-- BLAST CAMPAIGNS
-- ============================================================
create table blast_campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  template_id uuid references message_templates(id),
  custom_message text,           -- Use this OR template_id
  status text default 'draft' check (status in ('draft', 'running', 'paused', 'completed', 'failed')),
  total_recipients integer default 0,
  sent_count integer default 0,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- ============================================================
-- BLAST RECIPIENTS (per-contact tracking)
-- ============================================================
create table blast_recipients (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references blast_campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  status text default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text
);

-- ============================================================
-- ENABLE REALTIME
-- Run these in Supabase SQL editor (requires superuser)
-- Or enable via Supabase Dashboard > Database > Replication
-- ============================================================
alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table blast_campaigns;
alter publication supabase_realtime add table blast_recipients;
