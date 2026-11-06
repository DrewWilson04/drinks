-- drinks: initial schema
-- Profiles, follows (public/private accounts), drink logs, groups/events,
-- cheers + comments, leaderboard RPC, and photo storage. All access is
-- enforced with row level security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default ''
    check (char_length(display_name) <= 50),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 280),
  is_private boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs in for the first time.
-- Username is a placeholder until they pick one during onboarding.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'user_' || substr(md5(new.id::text), 1, 12),
    left(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ), 50),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Follows
-- Following a public account is accepted immediately; following a private
-- account creates a pending request the owner must approve.
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id, status);

create or replace function public.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := case
      when (select is_private from public.profiles where id = new.following_id)
        then 'pending'
      else 'accepted'
    end;
  elsif tg_op = 'UPDATE' then
    -- Only the person being followed may change the status, and only to accept.
    if new.follower_id <> old.follower_id or new.following_id <> old.following_id then
      raise exception 'cannot change follow participants';
    end if;
    if new.status <> old.status and auth.uid() <> old.following_id then
      raise exception 'only the followed user can accept a request';
    end if;
  end if;
  return new;
end;
$$;

create trigger follows_set_status
  before insert or update on public.follows
  for each row execute function public.set_follow_status();

-- When an account goes public, approve any pending requests.
create or replace function public.accept_pending_on_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted'
    where following_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger profiles_accept_pending
  after update of is_private on public.profiles
  for each row execute function public.accept_pending_on_public();

-- ---------------------------------------------------------------------------
-- Groups and events
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 280),
  kind text not null default 'group' check (kind in ('group', 'event')),
  starts_at timestamptz,
  ends_at timestamptz,
  invite_code text not null unique
    default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- The creator becomes the owner.
create or replace function public.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger groups_add_owner
  after insert on public.groups
  for each row execute function public.add_group_owner();

-- ---------------------------------------------------------------------------
-- Drinks
-- standard_drinks uses the US definition: 14 g of pure alcohol.
-- ---------------------------------------------------------------------------
create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  drink_type text not null check (drink_type in (
    'beer', 'wine', 'cocktail', 'shot', 'spirit', 'cider', 'seltzer', 'other'
  )),
  name text not null default '' check (char_length(name) <= 80),
  volume_ml numeric(7, 1) not null check (volume_ml > 0 and volume_ml <= 5000),
  abv numeric(4, 1) not null check (abv >= 0 and abv <= 100),
  standard_drinks numeric(6, 2)
    generated always as (round(volume_ml * abv / 100 * 0.789 / 14, 2)) stored,
  notes text not null default '' check (char_length(notes) <= 500),
  photo_path text,
  group_id uuid references public.groups (id) on delete set null,
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index drinks_user_time_idx on public.drinks (user_id, consumed_at desc);
create index drinks_time_idx on public.drinks (consumed_at desc);
create index drinks_group_idx on public.drinks (group_id, consumed_at desc);

-- ---------------------------------------------------------------------------
-- Cheers and comments
-- ---------------------------------------------------------------------------
create table public.cheers (
  drink_id uuid not null references public.drinks (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drink_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  drink_id uuid not null references public.drinks (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_drink_idx on public.comments (drink_id, created_at);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Can the current user see this person's drinks?
create or replace function public.can_view_user(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = owner and not p.is_private)
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = owner
        and f.status = 'accepted'
    );
$$;

-- Can the current user see this drink? Drinks logged to a group are also
-- visible to that group's members, even if the drinker's account is private.
create or replace function public.can_view_drink(did uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drinks d
    where d.id = did
      and (
        public.can_view_user(d.user_id)
        or (d.group_id is not null and public.is_group_member(d.group_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.drinks enable row level security;
alter table public.cheers enable row level security;
alter table public.comments enable row level security;

-- Profiles: basic profile info is public (so people can find and request to
-- follow private accounts). Only the owner can edit.
create policy "profiles are readable" on public.profiles
  for select using (true);
create policy "users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Follows: both sides can see the relationship; public accounts' accepted
-- followers are visible to everyone.
create policy "follows are readable" on public.follows
  for select using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or (status = 'accepted' and public.can_view_user(following_id))
  );
create policy "users follow as themselves" on public.follows
  for insert with check (follower_id = auth.uid());
create policy "followed user accepts" on public.follows
  for update using (following_id = auth.uid());
create policy "either side removes follow" on public.follows
  for delete using (follower_id = auth.uid() or following_id = auth.uid());

-- Groups: visible to members. Joining is done with join_group(code).
create policy "members see groups" on public.groups
  for select using (public.is_group_member(id) or created_by = auth.uid());
create policy "users create groups" on public.groups
  for insert with check (created_by = auth.uid());
create policy "owners update groups" on public.groups
  for update using (public.is_group_owner(id));
create policy "owners delete groups" on public.groups
  for delete using (public.is_group_owner(id));

create policy "members see members" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "leave or remove members" on public.group_members
  for delete using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_group_owner(group_id) and user_id <> auth.uid())
  );

-- Drinks
create policy "visible drinks" on public.drinks
  for select using (
    public.can_view_user(user_id)
    or (group_id is not null and public.is_group_member(group_id))
  );
create policy "log own drinks" on public.drinks
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );
create policy "edit own drinks" on public.drinks
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );
create policy "delete own drinks" on public.drinks
  for delete using (user_id = auth.uid());

-- Cheers and comments follow the drink's visibility.
create policy "visible cheers" on public.cheers
  for select using (public.can_view_drink(drink_id));
create policy "cheer visible drinks" on public.cheers
  for insert with check (user_id = auth.uid() and public.can_view_drink(drink_id));
create policy "remove own cheers" on public.cheers
  for delete using (user_id = auth.uid());

create policy "visible comments" on public.comments
  for select using (public.can_view_drink(drink_id));
create policy "comment on visible drinks" on public.comments
  for insert with check (user_id = auth.uid() and public.can_view_drink(drink_id));
create policy "delete own comments or comments on own drinks" on public.comments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.drinks d where d.id = drink_id and d.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Join a group with its invite code. Returns the group id.
create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id into gid from public.groups where invite_code = lower(trim(code));
  if gid is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$;

-- Look up a group's name from an invite code (for the join page preview).
create or replace function public.group_for_invite(code text)
returns table (id uuid, name text, kind text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, g.kind, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.groups g
  where g.invite_code = lower(trim(code));
$$;

-- Leaderboard. Runs as the caller, so RLS limits it to drinks they can see.
--   period: '24h' | '7d' | '30d' | 'all'
--   scope:  'everyone' | 'following' | 'group'
create or replace function public.leaderboard(
  period text default '7d',
  scope text default 'everyone',
  gid uuid default null,
  max_rows int default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  drink_count bigint,
  total_standard numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url,
    count(d.id) as drink_count,
    coalesce(sum(d.standard_drinks), 0) as total_standard
  from public.drinks d
  join public.profiles p on p.id = d.user_id
  where
    d.consumed_at >= case period
      when '24h' then now() - interval '24 hours'
      when '7d' then now() - interval '7 days'
      when '30d' then now() - interval '30 days'
      else '-infinity'::timestamptz
    end
    and d.consumed_at <= now() + interval '1 hour'
    and case scope
      when 'following' then
        d.user_id = auth.uid()
        or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      when 'group' then d.group_id = gid
      else true
    end
  group by p.id
  order by total_standard desc, drink_count desc
  limit least(greatest(max_rows, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Photo storage. Photos live under <user_id>/<file>. They can be read by
-- anyone who can see the drink that references them.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('drink-photos', 'drink-photos', false)
on conflict (id) do nothing;

create policy "upload own drink photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'drink-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "delete own drink photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'drink-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "read photos of visible drinks" on storage.objects
  for select to authenticated using (
    bucket_id = 'drink-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.drinks d where d.photo_path = objects.name)
    )
  );
