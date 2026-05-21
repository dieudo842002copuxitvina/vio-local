-- =============================================================================
-- VIO LOCAL — Initialize profiles + user_roles
-- =============================================================================
-- Depends on: auth.users (Supabase built-in)
-- Note: province_id / district_id / ward_id FK constraints are intentionally
--       omitted here. They will be added after geographic tables exist.
--       See DB_IMPLEMENTATION_ORDER.md phase 4 → 0006–0008.
-- =============================================================================


-- ── 1. ENUM ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum (
    'buyer',
    'merchant',
    'moderator',
    'admin'
  );
exception
  when duplicate_object then null;
end $$;


-- ── 2. PROFILES ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  -- 1:1 with auth.users. Cascade-delete cleans up on account removal.
  id            uuid primary key references auth.users(id) on delete cascade,

  display_name  text,
  avatar_url    text,
  phone         text,
  bio           text,

  -- Geographic preference (plain integers; FK constraints added after geo tables)
  province_id   smallint,
  district_id   integer,
  ward_id       integer,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile extending auth.users (1:1). '
  'Geographic FK constraints added in 0006_provinces / 0007_districts / 0008_communes.';


-- ── 3. USER_ROLES ─────────────────────────────────────────────────────────────

create table if not exists public.user_roles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        public.user_role not null default 'buyer',
  granted_by  uuid        references auth.users(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One active role per user. Change role via UPDATE, not INSERT.
  unique (user_id)
);

comment on table public.user_roles is
  'Single active role per user. '
  'Auto-seeded to ''buyer'' on sign-up. '
  'Bootstrap first admin via Supabase SQL editor or seed migration (service role bypasses RLS).';


-- ── 4. UPDATED_AT FUNCTION ────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── 5. UPDATED_AT TRIGGERS ────────────────────────────────────────────────────

create or replace trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger trg_user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();


-- ── 6. AUTO-PROFILE TRIGGER ───────────────────────────────────────────────────
-- Fires on every auth.users INSERT: email/password AND Google OAuth.
-- SECURITY DEFINER: runs as the function owner so it can write to public schema
-- from an auth schema context. SET search_path prevents injection attacks.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',  -- populated by Google OAuth
      split_part(new.email, '@', 1)          -- email prefix as fallback
    ),
    new.raw_user_meta_data->>'avatar_url'    -- Google avatar; null for email signup
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'buyer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- drop + create (not create or replace) — required for triggers on auth schema
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 7. ADMIN HELPER ───────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on user_roles when called inside RLS policies.
-- Without it, the policy would recurse into itself checking the same table.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.user_roles
    where  user_id = auth.uid()
    and    role    = 'admin'
  )
$$;


-- ── 8. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;


-- ── 9. RLS POLICIES — profiles ────────────────────────────────────────────────

-- Public discovery platform: all profiles are readable (including anonymous)
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Users can only update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using     (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT: handled exclusively by handle_new_user() trigger (service-role context)
-- DELETE: not permitted via API — soft-delete at application layer if needed


-- ── 10. RLS POLICIES — user_roles ─────────────────────────────────────────────

-- Users see their own role; admins see all
create policy "user_roles_select"
  on public.user_roles for select
  using (
    auth.uid() = user_id
    or public.is_admin()
  );

-- Only admins can assign / change / revoke roles
create policy "user_roles_insert_admin"
  on public.user_roles for insert
  with check (public.is_admin());

create policy "user_roles_update_admin"
  on public.user_roles for update
  using (public.is_admin());

create policy "user_roles_delete_admin"
  on public.user_roles for delete
  using (public.is_admin());


-- ── 11. INDEXES ───────────────────────────────────────────────────────────────

create index if not exists idx_profiles_province
  on public.profiles(province_id) where province_id is not null;

create index if not exists idx_profiles_district
  on public.profiles(district_id) where district_id is not null;

create index if not exists idx_profiles_phone
  on public.profiles(phone) where phone is not null;

create index if not exists idx_user_roles_user
  on public.user_roles(user_id);

create index if not exists idx_user_roles_role
  on public.user_roles(role);
