-- Tum Pa Guay POS V8.2 upgrade
-- Run once in Supabase SQL Editor as postgres.

create table if not exists public.restaurant_settings (
  id integer primary key default 1 check (id = 1),
  vat_mode text not null default 'inclusive' check (vat_mode in ('inclusive','exclusive')),
  vat_rate numeric(5,2) not null default 10 check (vat_rate >= 0 and vat_rate <= 100),
  updated_at timestamptz not null default now()
);

insert into public.restaurant_settings (id,vat_mode,vat_rate)
values (1,'inclusive',10)
on conflict (id) do nothing;

alter table public.restaurant_settings enable row level security;

drop policy if exists "authenticated can read restaurant settings" on public.restaurant_settings;
create policy "authenticated can read restaurant settings"
on public.restaurant_settings for select to authenticated using (true);

drop policy if exists "authenticated can update restaurant settings" on public.restaurant_settings;
create policy "authenticated can update restaurant settings"
on public.restaurant_settings for all to authenticated using (true) with check (true);

alter table public.orders add column if not exists vat_mode text default 'inclusive' check (vat_mode in ('inclusive','exclusive'));

grant select,insert,update on public.restaurant_settings to authenticated;

select 'V8.2 upgrade complete' as status;
