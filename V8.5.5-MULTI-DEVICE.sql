-- Tum Pa Guay V8.5.5 — Multi-device Safety + Realtime Sync
-- Run ONCE in Supabase SQL Editor before using V8.5.5 on multiple devices.

create table if not exists public.pos_table_locks (
  table_id uuid primary key references public.restaurant_tables(id) on delete cascade,
  device_id text not null,
  device_label text not null default 'POS',
  user_id uuid references auth.users(id) on delete set null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

alter table public.pos_table_locks enable row level security;
drop policy if exists "staff read pos locks" on public.pos_table_locks;
create policy "staff read pos locks" on public.pos_table_locks for select to authenticated using (public.is_active_admin());

create or replace function public.acquire_pos_table_lock(p_table_id uuid, p_device_id text, p_device_label text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_lock public.pos_table_locks%rowtype;
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'Not authorized'; end if;
  delete from public.pos_table_locks where expires_at <= now();
  select * into v_lock from public.pos_table_locks where table_id=p_table_id for update;
  if found and v_lock.device_id <> p_device_id then
    return jsonb_build_object('ok',false,'device_label',v_lock.device_label,'expires_at',v_lock.expires_at);
  end if;
  insert into public.pos_table_locks(table_id,device_id,device_label,user_id,locked_at,expires_at)
  values(p_table_id,p_device_id,coalesce(nullif(p_device_label,''),'POS'),auth.uid(),now(),now()+interval '2 minutes')
  on conflict(table_id) do update set device_id=excluded.device_id,device_label=excluded.device_label,user_id=excluded.user_id,locked_at=now(),expires_at=now()+interval '2 minutes';
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.release_pos_table_lock(p_table_id uuid, p_device_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.pos_table_locks where table_id=p_table_id and device_id=p_device_id;
  return true;
end $$;

grant execute on function public.acquire_pos_table_lock(uuid,text,text) to authenticated;
grant execute on function public.release_pos_table_lock(uuid,text) to authenticated;

-- Database-level protection: one active bill per table.
create unique index if not exists uq_orders_one_active_per_table
on public.orders(table_id) where table_id is not null and status in ('open','ready_to_pay');

-- Prevent duplicate payment records for the same bill.
create unique index if not exists uq_payments_one_per_order on public.payments(order_id);

-- Add tables to Realtime publication when possible. Safe to re-run.
do $$ begin
  begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.order_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pos_table_locks; exception when duplicate_object then null; end;
end $$;
