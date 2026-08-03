-- ============================================================
-- Tum Pa Guay POS V8.2 - SAFE UPGRADE (FIXED)
-- Run ONCE in Supabase SQL Editor using the postgres role.
-- This migration keeps all existing menu, order, table and sales data.
-- ============================================================

begin;

-- 1) Ensure the settings table exists.
-- Some older versions already have this table but do not have VAT columns.
create table if not exists public.restaurant_settings (
  id integer primary key
);

-- 2) Add the V8.2 columns BEFORE inserting V8.2 data.
alter table public.restaurant_settings
  add column if not exists vat_mode text;

alter table public.restaurant_settings
  add column if not exists vat_rate numeric(5,2);

alter table public.restaurant_settings
  add column if not exists updated_at timestamptz;

-- 3) Fill missing values in old rows.
update public.restaurant_settings
set
  vat_mode = coalesce(vat_mode, 'inclusive'),
  vat_rate = coalesce(vat_rate, 10),
  updated_at = coalesce(updated_at, now());

-- 4) Apply defaults and required-column rules.
alter table public.restaurant_settings
  alter column id set default 1,
  alter column vat_mode set default 'inclusive',
  alter column vat_mode set not null,
  alter column vat_rate set default 10,
  alter column vat_rate set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- 5) Add validation constraints only when they do not already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_settings'::regclass
      and conname = 'restaurant_settings_single_row_check'
  ) then
    alter table public.restaurant_settings
      add constraint restaurant_settings_single_row_check check (id = 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_settings'::regclass
      and conname = 'restaurant_settings_vat_mode_check'
  ) then
    alter table public.restaurant_settings
      add constraint restaurant_settings_vat_mode_check
      check (vat_mode in ('inclusive', 'exclusive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_settings'::regclass
      and conname = 'restaurant_settings_vat_rate_check'
  ) then
    alter table public.restaurant_settings
      add constraint restaurant_settings_vat_rate_check
      check (vat_rate >= 0 and vat_rate <= 100);
  end if;
end $$;

-- 6) Create the single settings row, or preserve/update the existing row.
insert into public.restaurant_settings (id, vat_mode, vat_rate, updated_at)
values (1, 'inclusive', 10, now())
on conflict (id) do update
set
  vat_mode = coalesce(public.restaurant_settings.vat_mode, excluded.vat_mode),
  vat_rate = coalesce(public.restaurant_settings.vat_rate, excluded.vat_rate),
  updated_at = now();

-- 7) Enable RLS and recreate the authenticated-user policies.
alter table public.restaurant_settings enable row level security;

drop policy if exists "authenticated can read restaurant settings"
on public.restaurant_settings;

create policy "authenticated can read restaurant settings"
on public.restaurant_settings
for select
to authenticated
using (true);

drop policy if exists "authenticated can update restaurant settings"
on public.restaurant_settings;

create policy "authenticated can update restaurant settings"
on public.restaurant_settings
for all
to authenticated
using (true)
with check (true);

grant select, insert, update on public.restaurant_settings to authenticated;

-- 8) Save the VAT mode used by each order.
do $$
begin
  if to_regclass('public.orders') is not null then
    alter table public.orders
      add column if not exists vat_mode text;

    update public.orders
    set vat_mode = 'inclusive'
    where vat_mode is null;

    alter table public.orders
      alter column vat_mode set default 'inclusive';

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.orders'::regclass
        and conname = 'orders_vat_mode_check'
    ) then
      alter table public.orders
        add constraint orders_vat_mode_check
        check (vat_mode in ('inclusive', 'exclusive'));
    end if;
  end if;
end $$;

commit;

select
  'V8.2 upgrade complete' as status,
  vat_mode,
  vat_rate
from public.restaurant_settings
where id = 1;
