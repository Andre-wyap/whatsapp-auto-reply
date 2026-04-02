-- ============================================================
-- CONTACT GROUPS
-- Each group represents a product/category and links to a
-- Google Sheet. Contacts can belong to multiple groups.
-- ============================================================
create table contact_groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  sheet_url   text,                      -- Google Sheet URL for sync
  description text,
  created_at  timestamptz default now()
);

-- ============================================================
-- CONTACT GROUP MEMBERS (many-to-many)
-- Status lives here, not on contacts — same person can have
-- a different status in each group they belong to.
-- ============================================================
create table contact_group_members (
  contact_id  uuid not null references contacts(id) on delete cascade,
  group_id    uuid not null references contact_groups(id) on delete cascade,
  status      text,
  added_at    timestamptz default now(),
  primary key (contact_id, group_id)
);

create index contact_group_members_group_id_idx on contact_group_members(group_id);
create index contact_group_members_status_idx   on contact_group_members(group_id, status);

-- ============================================================
-- CLEAN UP CONTACTS TABLE
-- Status moves to contact_group_members.
-- Tags are removed — hierarchy is now Group → Status.
-- Remark stays on the contact row (shared across groups).
-- ============================================================
alter table contacts
  drop column if exists status,
  drop column if exists tags;

-- Ensure remark exists (added in 002 but guard here too)
alter table contacts
  add column if not exists remark text;
