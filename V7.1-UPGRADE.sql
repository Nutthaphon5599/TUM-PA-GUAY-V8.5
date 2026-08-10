-- Tum Pa Guay POS V7.1 upgrade
-- Safe to run after V7.0 migration. Ensures the first 90 huts exist.
insert into public.restaurant_tables(table_number, label, capacity, active)
select n, 'ຕູບ ' || n, 4, true
from generate_series(1, 90) n
on conflict (table_number) do nothing;

select count(*) filter (where active) as active_huts, count(*) as all_huts
from public.restaurant_tables;
