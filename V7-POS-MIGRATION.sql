-- ============================================================
-- Tum Pa Guay Restaurant V7.1 POS migration
-- Run ONCE in Supabase SQL Editor after the V6.2 setup.
-- Adds restaurant tables, orders, order items and payments.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null unique check (table_number > 0),
  label text,
  capacity integer not null default 4 check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  table_number integer,
  status text not null default 'open' check (status in ('open','ready_to_pay','paid','cancelled')),
  customer_name text,
  note text,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  vat_rate numeric(6,3) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_table_number on public.orders(table_number);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  line_total numeric(14,2) generated always as (unit_price * quantity) stored,
  variant text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('cash','bank_transfer','qr','other')),
  amount numeric(14,2) not null check (amount >= 0),
  received_amount numeric(14,2),
  change_amount numeric(14,2),
  reference text,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments(order_id);

-- updated_at triggers (function comes from V6.2 setup)
drop trigger if exists trg_restaurant_tables_updated_at on public.restaurant_tables;
create trigger trg_restaurant_tables_updated_at before update on public.restaurant_tables
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_order_items_updated_at on public.order_items;
create trigger trg_order_items_updated_at before update on public.order_items
for each row execute function public.set_updated_at();

-- Create 90 huts (ຕູບ) to match current restaurant capacity.
insert into public.restaurant_tables(table_number, label, capacity)
select n, 'ໂຕະ ' || n, 4
from generate_series(1, 90) n
on conflict (table_number) do nothing;

alter table public.restaurant_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- POS data is available only to authenticated active staff/admin/owner.
drop policy if exists "staff read restaurant tables" on public.restaurant_tables;
create policy "staff read restaurant tables" on public.restaurant_tables
for select to authenticated using (public.is_active_admin());

drop policy if exists "staff manage restaurant tables" on public.restaurant_tables;
create policy "staff manage restaurant tables" on public.restaurant_tables
for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
for select to authenticated using (public.is_active_admin());

drop policy if exists "staff insert orders" on public.orders;
create policy "staff insert orders" on public.orders
for insert to authenticated with check (public.is_active_admin());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists "staff delete orders" on public.orders;
create policy "staff delete orders" on public.orders
for delete to authenticated using (public.is_active_admin());

drop policy if exists "staff read order items" on public.order_items;
create policy "staff read order items" on public.order_items
for select to authenticated using (public.is_active_admin());

drop policy if exists "staff manage order items" on public.order_items;
create policy "staff manage order items" on public.order_items
for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists "staff read payments" on public.payments;
create policy "staff read payments" on public.payments
for select to authenticated using (public.is_active_admin());

drop policy if exists "staff insert payments" on public.payments;
create policy "staff insert payments" on public.payments
for insert to authenticated with check (public.is_active_admin());

select 'restaurant_tables' as table_name, count(*) as total from public.restaurant_tables
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'payments', count(*) from public.payments;
