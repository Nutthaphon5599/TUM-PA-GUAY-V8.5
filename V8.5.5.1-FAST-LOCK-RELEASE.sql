-- Tum Pa Guay V8.5.5.1 Fix — Fast Lock Release
-- Run ONCE after V8.5.5-MULTI-DEVICE.sql. Safe to re-run.

alter table public.pos_table_locks
  alter column expires_at set default (now() + interval '30 seconds');

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
  values(p_table_id,p_device_id,coalesce(nullif(p_device_label,''),'POS'),auth.uid(),now(),now()+interval '30 seconds')
  on conflict(table_id) do update set device_id=excluded.device_id,device_label=excluded.device_label,user_id=excluded.user_id,locked_at=now(),expires_at=now()+interval '30 seconds';
  return jsonb_build_object('ok',true);
end $$;

grant execute on function public.acquire_pos_table_lock(uuid,text,text) to authenticated;
delete from public.pos_table_locks where expires_at <= now();
