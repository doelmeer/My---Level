-- LifeXP V2 database schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default 'User',
  avatar_url text,
  country text,
  city text,
  global_xp integer not null default 0,
  streak integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null,
  minutes integer not null check(minutes > 0 and minutes <= 1440),
  xp integer not null default 0,
  verification text not null default 'manual',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default 'Learning',
  duration_minutes integer not null default 30 check(duration_minutes > 0 and duration_minutes <= 1440),
  scheduled_for timestamptz not null,
  completed boolean not null default false,
  completed_at timestamptz
);

create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id <> following_id)
);

create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(activity_id,user_id)
);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.plans enable row level security;
alter table public.follows enable row level security;
alter table public.kudos enable row level security;

create policy "profiles public read" on public.profiles for select using (is_public or auth.uid()=id);
create policy "profile owner insert" on public.profiles for insert with check(auth.uid()=id);
create policy "profile owner update" on public.profiles for update using(auth.uid()=id);

create policy "activities owner read" on public.activities for select using(auth.uid()=user_id or exists(select 1 from public.profiles p where p.id=user_id and p.is_public));
create policy "activities owner insert" on public.activities for insert with check(auth.uid()=user_id);
create policy "activities owner update" on public.activities for update using(auth.uid()=user_id);
create policy "activities owner delete" on public.activities for delete using(auth.uid()=user_id);

create policy "plans owner all" on public.plans for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "follow read" on public.follows for select using(true);
create policy "follow insert" on public.follows for insert with check(auth.uid()=follower_id);
create policy "follow delete" on public.follows for delete using(auth.uid()=follower_id);
create policy "kudos read" on public.kudos for select using(true);
create policy "kudos insert" on public.kudos for insert with check(auth.uid()=user_id);
create policy "kudos delete" on public.kudos for delete using(auth.uid()=user_id);

-- Automatically create a profile after signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username,display_name)
  values(new.id,'user_'||substr(new.id::text,1,8),coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- XP calculation + basic daily cap (1000 XP/day) is enforced server-side.
create or replace function public.log_activity(p_name text,p_category text,p_minutes integer)
returns integer language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); w numeric:=1; earned integer; used integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_minutes <= 0 or p_minutes > 1440 then raise exception 'Invalid duration'; end if;
  if p_category='Fitness' then w:=1.15;
  elsif p_category='Work' then w:=1.17;
  elsif p_category='Creativity' then w:=1.10;
  elsif p_category='Recovery' then w:=0.50; end if;
  earned:=round(p_minutes*w);
  select coalesce(sum(xp),0) into used from activities where user_id=uid and started_at::date=now()::date;
  earned:=greatest(0,least(earned,1000-used));
  insert into activities(user_id,name,category,minutes,xp) values(uid,p_name,p_category,p_minutes,earned);
  update profiles set global_xp=global_xp+earned where id=uid;
  return earned;
end; $$;

create or replace function public.complete_plan(p_plan_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p plans%rowtype; earned integer;
begin
  select * into p from plans where id=p_plan_id and user_id=uid for update;
  if p.id is null then raise exception 'Plan not found'; end if;
  if p.completed then return 0; end if;
  earned:=public.log_activity(p.name,p.category,p.duration_minutes);
  update plans set completed=true,completed_at=now() where id=p.id;
  return earned;
end; $$;

grant execute on function public.log_activity(text,text,integer) to authenticated;
grant execute on function public.complete_plan(uuid) to authenticated;