-- Tum Pa Guay V6.1 verification / repair patch
-- Safe to run after the main supabase-setup.sql.

-- Verify expected columns and data.
select count(*) as categories_total from public.categories;
select count(*) as menu_items_total from public.menu_items;
select count(*) as reservations_total from public.reservations;

-- Re-create public read policies if they were accidentally removed.
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories"
on public.categories for select
to anon, authenticated
using (active = true or public.is_active_admin());

drop policy if exists "Public read available menu" on public.menu_items;
create policy "Public read available menu"
on public.menu_items for select
to anon, authenticated
using (available = true or public.is_active_admin());

drop policy if exists "Public create reservations" on public.reservations;
create policy "Public create reservations"
on public.reservations for insert
to anon, authenticated
with check (guest_count > 0 and booking_date >= current_date);

-- Ensure the image bucket remains public.
update storage.buckets
set public = true
where id = 'menu-images';

select 'V6.1 patch completed' as result;
