-- Add status and remark fields to contacts (from Google Sheet sync)
alter table contacts
  add column if not exists status text,
  add column if not exists remark text;
