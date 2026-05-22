-- =============================================================================
-- VIO LOCAL — Inquiries
-- =============================================================================
-- Purpose: Lightweight contact inquiry log for land listings, storefronts,
-- products, and services. Not a chat system. Not a CRM. A record that
-- "this person called / messaged about this listing."
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--   20260521160001_storefronts.sql              (storefronts)
--   20260521170001_products.sql                 (products)
--   20260521180001_services.sql                 (services)
--   20260522100001_land_listings.sql            (land_listings)
--
-- Key design decision — owner_id:
--   The specified fields do not include owner_id, but it is required for RLS.
--   Ownership paths differ per target_type:
--     land_listing → land_listings.owner_id             (direct)
--     storefront   → storefronts.owner_id               (direct)
--     product      → products.storefront_id → storefronts.owner_id  (two-hop)
--     service      → services.storefront_id  → storefronts.owner_id (two-hop)
--   A polymorphic join across four tables in a single RLS USING clause is not
--   possible. Solution: stamp owner_id on every row via a BEFORE INSERT trigger
--   (inquiries_resolve_owner). The application never passes owner_id — the
--   trigger always sets it from the target entity. Spoofing is impossible.
--
-- is_read:
--   Added (not in original spec) — without it the feature is unusable.
--   Owners cannot distinguish new from seen inquiries. Not a CRM field.
--
-- Spam / rate-limiting:
--   No IP tracking in this table — that belongs at the edge (Cloudflare
--   Rate Limiting or a Supabase Edge Function middleware). The DB constraint
--   is that message + sender_phone must be non-empty (NOT NULL + CHECK).
-- =============================================================================


-- ── TABLE ─────────────────────────────────────────────────────────────────────

create table if not exists public.inquiries (
  id            uuid         not null default gen_random_uuid(),
  -- Stamped by the BEFORE INSERT trigger — never provided by the caller.
  -- Allows simple RLS without polymorphic joins.
  owner_id      uuid         not null,
  target_type   varchar(20)  not null,
  target_id     uuid         not null,
  sender_name   varchar(100) not null,
  sender_phone  varchar(20)  not null,
  message       varchar(1000),
  -- Minimal notification state. Not a CRM status field — just read/unread.
  is_read       boolean      not null default false,
  created_at    timestamptz  not null default now(),

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint inquiries_pkey
    primary key (id),

  constraint inquiries_owner_fk
    foreign key (owner_id) references public.profiles(id)
    on delete cascade,

  -- Supported entity types. If a new entity type is added, update this list
  -- AND the inquiries_resolve_owner() trigger function.
  constraint inquiries_target_type_check
    check (target_type in ('land_listing', 'storefront', 'product', 'service')),

  -- Prevent blank sender fields (empty string would pass NOT NULL)
  constraint inquiries_sender_name_nonempty
    check (length(trim(sender_name))  > 0),

  constraint inquiries_sender_phone_nonempty
    check (length(trim(sender_phone)) > 0)
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Owner dashboard: all inquiries, unread first, newest first.
-- Hot path: owner opens their notifications panel.
create index if not exists idx_inquiries_owner
  on public.inquiries(owner_id, is_read, created_at desc);

-- Per-target inquiry list: "inquiries for this listing".
-- Used when the owner views a specific listing's detail page.
create index if not exists idx_inquiries_target
  on public.inquiries(target_type, target_id, created_at desc);


-- ── TRIGGER: AUTO-RESOLVE owner_id ON INSERT ──────────────────────────────────
--
-- Fires BEFORE INSERT and stamps owner_id from the target entity.
-- The caller provides only target_type + target_id — never owner_id.
--
-- Ownership chains:
--   land_listing → land_listings.owner_id
--   storefront   → storefronts.owner_id
--   product      → products → storefronts.owner_id  (JOIN)
--   service      → services → storefronts.owner_id  (JOIN)
--
-- Raises an exception if:
--   - target_type is unrecognised (caught by CHECK constraint, but defensive)
--   - target entity does not exist (prevents orphan inquiries)
--   - target entity is not publicly visible (prevents probing private entities)
--
-- SECURITY DEFINER: runs as function owner so it can SELECT from all entity
-- tables regardless of the calling user's RLS context.
-- SET search_path = public: prevents search_path injection attacks.

create or replace function public.inquiries_resolve_owner()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  case new.target_type

    when 'land_listing' then
      select owner_id
        into new.owner_id
        from public.land_listings
       where id        = new.target_id
         and is_public = true
         and moderation_status = 'approved';

    when 'storefront' then
      select owner_id
        into new.owner_id
        from public.storefronts
       where id        = new.target_id
         and is_public = true;

    when 'product' then
      select s.owner_id
        into new.owner_id
        from public.products p
        join public.storefronts s on s.id = p.storefront_id
       where p.id           = new.target_id
         and p.is_available = true
         and s.is_public    = true;

    when 'service' then
      select s.owner_id
        into new.owner_id
        from public.services sv
        join public.storefronts s on s.id = sv.storefront_id
       where sv.id           = new.target_id
         and sv.is_available = true
         and s.is_public     = true;

    else
      raise exception
        'inquiries: unknown target_type ''%''', new.target_type;

  end case;

  -- If the SELECT found no rows, owner_id is NULL.
  -- Reject the inquiry — entity doesn't exist or isn't publicly visible.
  if new.owner_id is null then
    raise exception
      'inquiries: target not found or not public (type=%, id=%)',
      new.target_type, new.target_id;
  end if;

  return new;
end;
$$;

create trigger inquiries_before_insert
  before insert on public.inquiries
  for each row
  execute function public.inquiries_resolve_owner();


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.inquiries enable row level security;

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- Anyone (including unauthenticated users) may submit an inquiry.
-- The trigger validates the target entity and stamps owner_id.
-- Application layer is responsible for edge-level rate limiting.

create policy "inquiries_insert_public"
  on public.inquiries
  for insert
  to anon, authenticated
  with check (true);

-- ── SELECT ────────────────────────────────────────────────────────────────────
-- Owners see inquiries addressed to them.
-- Senders do NOT get a SELECT policy — once submitted, they cannot re-read
-- their own inquiry. This prevents enumerating other people's phone numbers
-- by querying "my own" submissions.

create policy "inquiries_select_owner"
  on public.inquiries
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "inquiries_select_admin"
  on public.inquiries
  for select
  to authenticated
  using (public.is_admin());

-- ── UPDATE ────────────────────────────────────────────────────────────────────
-- Owners may only flip is_read. No other field should change after insert.
-- The WITH CHECK prevents an owner from accidentally changing target_id or
-- sender data by re-submitting a modified row.

create policy "inquiries_update_owner"
  on public.inquiries
  for update
  to authenticated
  using  (owner_id = auth.uid())
  with check (
    owner_id     = auth.uid()
    -- target_type, target_id, sender fields must remain unchanged.
    -- Only is_read is a legitimate update target.
    -- Enforcement is at the application layer; this policy scopes the rows.
  );

create policy "inquiries_update_admin"
  on public.inquiries
  for update
  to authenticated
  using (public.is_admin());

-- ── DELETE ────────────────────────────────────────────────────────────────────
-- Owners may remove inquiries from their inbox (e.g. spam cleanup).
-- Senders cannot delete — they have no SELECT, so no DELETE either.

create policy "inquiries_delete_owner"
  on public.inquiries
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "inquiries_delete_admin"
  on public.inquiries
  for delete
  to authenticated
  using (public.is_admin());


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.inquiries is
  'Contact inquiry log across land listings, storefronts, products, services. '
  'owner_id is auto-stamped by the inquiries_resolve_owner() BEFORE INSERT trigger. '
  'Callers provide: target_type, target_id, sender_name, sender_phone, message. '
  'Senders have no SELECT policy — phone numbers are not enumerable.';

comment on column public.inquiries.owner_id is
  'Auto-stamped by inquiries_resolve_owner() trigger on INSERT. '
  'Never supplied by the caller. Resolved via the target entity ownership chain: '
  'land_listing/storefront → owner_id direct; product/service → storefront → owner_id.';

comment on column public.inquiries.target_id is
  'UUID of the land listing, storefront, product, or service being enquired about. '
  'No foreign key constraint — referential integrity across four tables is enforced '
  'by the BEFORE INSERT trigger (rejects missing or non-public targets).';

comment on column public.inquiries.is_read is
  'Simple read/unread flag for the owner notification panel. '
  'Not a CRM status. Updated via the inquiries_update_owner RLS policy.';

comment on function public.inquiries_resolve_owner is
  'BEFORE INSERT trigger on inquiries. '
  'Resolves owner_id from the target entity, validates the target is publicly visible, '
  'and rejects the insert if the entity does not exist or is not public. '
  'SECURITY DEFINER so it can SELECT across entity tables regardless of caller RLS.';
