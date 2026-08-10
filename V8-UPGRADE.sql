-- Tum Pa Guay Restaurant V8.0 upgrade
-- Run once after V7.1. No sales records are deleted.
create index if not exists idx_orders_closed_at_paid on public.orders(closed_at desc) where status='paid';
create index if not exists idx_orders_order_number on public.orders(order_number);
create index if not exists idx_order_items_menu_name on public.order_items(item_name);
create index if not exists idx_payments_paid_at on public.payments(paid_at desc);

-- Read-only reporting views. Existing RLS on source tables still applies.
create or replace view public.v_daily_sales as
select (closed_at at time zone 'Asia/Vientiane')::date as sale_date,
       count(*) as bill_count,
       sum(subtotal) as subtotal,
       sum(discount) as discount,
       sum(vat_amount) as vat_amount,
       sum(grand_total) as grand_total
from public.orders where status='paid' and closed_at is not null
group by 1 order by 1 desc;

create or replace view public.v_top_menu_sales as
select oi.item_name, sum(oi.quantity) as quantity_sold, sum(oi.line_total) as sales_total
from public.order_items oi join public.orders o on o.id=oi.order_id
where o.status='paid'
group by oi.item_name order by quantity_sold desc;

grant select on public.v_daily_sales to authenticated;
grant select on public.v_top_menu_sales to authenticated;
select 'V8 upgrade complete' as status;
