-- ============================================================
-- CRM FIELDS (user-defined schema)
-- ============================================================
create table crm_fields (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  key text not null unique,  -- snake_case identifier, used as JSONB key
  type text not null default 'text' check (type in ('text', 'number', 'date', 'select', 'boolean')),
  options text[] default '{}', -- for type='select' only
  required boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- CRM CONTACTS
-- ============================================================
create table crm_contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  custom_data jsonb default '{}',  -- stores values for all crm_fields
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index crm_contacts_name_idx on crm_contacts(name);
create index crm_contacts_phone_idx on crm_contacts(phone);

-- ============================================================
-- n8n can create/update CRM contacts via:
--   POST /api/crm/contacts
--   Authorization: Bearer <API_KEY>
--   { "name": "John", "phone": "+601234", "email": "...", "custom_data": { "field_key": "value" } }
-- ============================================================
