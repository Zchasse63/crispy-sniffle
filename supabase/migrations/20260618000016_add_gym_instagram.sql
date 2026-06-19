-- Outbound link to a gym's public Instagram (handle stored; URL built for display).
alter table public.gyms add column if not exists instagram text;
