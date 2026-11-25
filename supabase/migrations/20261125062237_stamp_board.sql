-- Append-only transparent layers. Only the Edge Function's service role can access this table.
create table public.stamp_contributions (
  id uuid primary key,
  sequence bigint generated always as identity unique,
  owner_id uuid not null,
  x integer not null check (x >= 0),
  y integer not null check (y >= 0),
  width integer not null check (width > 0 and x + width <= 2400),
  height integer not null check (height > 0 and y + height <= 1600),
  color text not null check (color in ('#a52d2b','#33466d','#386557','#aa762b')),
  image_base64 text not null check (length(image_base64) between 1 and 349528),
  created_at timestamptz not null default now()
);
create index stamp_contributions_owner_time on public.stamp_contributions (owner_id, created_at);
alter table public.stamp_contributions enable row level security;
revoke all on public.stamp_contributions from anon, authenticated;
grant select, insert on public.stamp_contributions to service_role;
grant usage, select on sequence public.stamp_contributions_sequence_seq to service_role;

create function public.submit_stamp_contribution(p_owner uuid, p_id uuid, p_x integer, p_y integer, p_width integer, p_height integer, p_color text, p_image text)
returns setof public.stamp_contributions
language plpgsql security invoker set search_path = '' as $$
declare existing public.stamp_contributions; n_min integer; n_day integer;
begin
  -- Serializes the small experiment's caps and idempotency checks in one transaction.
  perform pg_advisory_xact_lock(47302026);
  select * into existing from public.stamp_contributions where id = p_id;
  if found then
    if existing.owner_id <> p_owner or existing.x <> p_x or existing.y <> p_y or existing.width <> p_width or existing.height <> p_height or existing.color <> p_color or existing.image_base64 <> p_image then
      raise exception 'conflict' using errcode = 'P0001';
    end if;
    return next existing; return;
  end if;
  if (select count(*) from public.stamp_contributions) >= 512 then raise exception 'full' using errcode = 'P0001'; end if;
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into n_min, n_day from public.stamp_contributions where owner_id = p_owner and created_at > now() - interval '1 day';
  if n_min >= 3 or n_day >= 20 then raise exception 'rate' using errcode = 'P0001'; end if;
  return query insert into public.stamp_contributions (owner_id,id,x,y,width,height,color,image_base64)
    values (p_owner,p_id,p_x,p_y,p_width,p_height,p_color,p_image) returning *;
end $$;
revoke all on function public.submit_stamp_contribution(uuid,uuid,integer,integer,integer,integer,text,text) from public, anon, authenticated;
grant execute on function public.submit_stamp_contribution(uuid,uuid,integer,integer,integer,integer,text,text) to service_role;
