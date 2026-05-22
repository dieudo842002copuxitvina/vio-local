-- =============================================================================
-- VIO LOCAL — Storefront Verifications
-- =============================================================================
-- Purpose: Lightweight trust record per storefront per verification type.
-- Not an enterprise KYC pipeline. Not a compliance system.
-- Each row is one verification attempt; the result flows back to
-- storefronts.is_verified via a trigger.
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--   20260521160001_storefronts.sql              (storefronts)
--
-- Relationship to storefronts.is_verified:
--   is_verified = true   ←→   at least one 'approved' verification exists.
--   The sync_storefront_is_verified() trigger recomputes the boolean
--   after every INSERT / UPDATE / DELETE on this table.
--   storefronts.is_verified is the display signal (badge, sort boost).
--   storefront_verifications is the audit trail (who, what, when, notes).
--
-- Verification types — intentionally narrow for Phase 1:
--   phone          — phone number confirmed (OTP or moderator call)
--   identity       — owner's government ID sighted (CCCD / CMND)
--   business       — Giấy đăng ký kinh doanh confirmed
--   local_verified — VIO LOCAL community trust signal (moderator vouches
--                    for the business in-person or via known local contacts)
--
-- Future scalability — add a new type:
--   ALTER TABLE storefront_verifications
--     DROP   CONSTRAINT storefront_verifications_type_check,
--     ADD    CONSTRAINT storefront_verifications_type_check
--            CHECK (verification_type IN (...existing..., 'new_type'));
--   No schema changes to any other table or function.
-- =============================================================================


-- ── TABLE ─────────────────────────────────────────────────────────────────────

create table if not exists public.storefront_verifications (
  id                   uuid         not null default gen_random_uuid(),
  storefront_id        uuid         not null,
  verification_type    varchar(30)  not null,
  verification_status  varchar(20)  not null default 'pending',
  submitted_at         timestamptz  not null default now(),
  reviewed_at          timestamptz,
  -- Which admin/moderator reviewed this record.
  -- SET NULL on profile delete — preserves the verification record
  -- even if the reviewer account is removed.
  reviewed_by          uuid,
  notes                text,

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint storefront_verifications_pkey
    primary key (id),

  constraint storefront_verifications_storefront_fk
    foreign key (storefront_id) references public.storefronts(id)
    on delete cascade,

  constraint storefront_verifications_reviewer_fk
    foreign key (reviewed_by) references public.profiles(id)
    on delete set null,

  -- One verification record per type per storefront.
  -- To re-verify after rejection: admin resets status to 'pending',
  -- or owner withdraws and re-submits (DELETE + INSERT).
  constraint storefront_verifications_unique_type
    unique (storefront_id, verification_type),

  -- Verification types supported in Phase 1.
  -- Extend by dropping + re-adding this constraint in a new migration.
  constraint storefront_verifications_type_check
    check (verification_type in (
      'phone',           -- phone number confirmed via OTP or moderator call
      'identity',        -- owner government ID verified (CCCD / CMND)
      'business',        -- Giấy đăng ký kinh doanh confirmed
      'local_verified'   -- VIO LOCAL community trust (in-person or local contact)
    )),

  -- Status lifecycle:
  --   pending  → approved  (moderator confirms)
  --   pending  → rejected  (moderator rejects — owner can re-apply)
  --   approved → expired   (e.g. ID document expires, business licence lapses)
  --   expired  → pending   (owner re-submits renewal)
  constraint storefront_verifications_status_check
    check (verification_status in ('pending', 'approved', 'rejected', 'expired')),

  -- reviewed_at and reviewed_by must both be set or both be null.
  -- Prevents half-reviewed rows (reviewed_at set but no reviewer, or vice versa).
  constraint storefront_verifications_review_consistency
    check (
      (reviewed_at is null and reviewed_by is null)
      or
      (reviewed_at is not null and reviewed_by is not null)
    )
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Hot path: "does this storefront have any approved verification?"
-- Used by the trigger and by storefront page loaders to decide badge display.
create index if not exists idx_sv_storefront_status
  on public.storefront_verifications(storefront_id, verification_status);

-- Moderation queue: pending verifications FIFO (oldest first → fairest review).
create index if not exists idx_sv_pending_queue
  on public.storefront_verifications(submitted_at asc)
  where verification_status = 'pending';

-- Reviewer audit: which verifications did a specific admin review?
create index if not exists idx_sv_reviewer
  on public.storefront_verifications(reviewed_by)
  where reviewed_by is not null;


-- ── TRIGGER: SYNC storefronts.is_verified ────────────────────────────────────
--
-- Fires AFTER INSERT OR UPDATE OR DELETE on storefront_verifications.
-- Recomputes storefronts.is_verified as:
--   true  ↔  at least one row for this storefront has verification_status = 'approved'
--   false ↔  no approved verifications exist
--
-- Uses COALESCE(NEW.storefront_id, OLD.storefront_id) to handle all three
-- trigger operations: INSERT (NEW only), UPDATE (NEW), DELETE (OLD only).
--
-- SECURITY DEFINER: must UPDATE storefronts regardless of the calling user's
-- RLS permissions. SET search_path prevents injection.

create or replace function public.sync_storefront_is_verified()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  v_storefront_id uuid;
begin
  v_storefront_id := coalesce(new.storefront_id, old.storefront_id);

  update public.storefronts
  set
    is_verified = exists (
      select 1
      from public.storefront_verifications
      where storefront_id      = v_storefront_id
        and verification_status = 'approved'
    ),
    updated_at = now()
  where id = v_storefront_id;

  return coalesce(new, old);
end;
$$;

create trigger storefront_verifications_sync_is_verified
  after insert or update or delete
  on public.storefront_verifications
  for each row
  execute function public.sync_storefront_is_verified();


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.storefront_verifications enable row level security;

-- ── SELECT ────────────────────────────────────────────────────────────────────

-- Public: only approved verifications — trust badge data.
-- anon can see that a storefront is verified (type + approved status)
-- but cannot see pending submissions or rejection notes.
create policy "sv_select_public"
  on public.storefront_verifications
  for select
  to anon, authenticated
  using (verification_status = 'approved');

-- Owner: full view of their own storefront's verification records.
-- Lets owners track the status of their submitted verifications.
create policy "sv_select_owner"
  on public.storefront_verifications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.storefronts
      where id       = storefront_id
        and owner_id = auth.uid()
    )
  );

-- Admin: unrestricted read for moderation queue and audit.
create policy "sv_select_admin"
  on public.storefront_verifications
  for select
  to authenticated
  using (public.is_admin());

-- ── INSERT ────────────────────────────────────────────────────────────────────

-- Owner submits a new verification request for their own storefront.
-- WITH CHECK enforces: status must start as 'pending', reviewed fields null.
-- reviewed_by is explicitly forced null — owners cannot self-approve.
create policy "sv_insert_owner"
  on public.storefront_verifications
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.storefronts
      where id       = storefront_id
        and owner_id = auth.uid()
    )
    and verification_status = 'pending'
    and reviewed_at          is null
    and reviewed_by          is null
  );

-- Admin: insert verifications directly (e.g. bulk onboarding of known businesses).
create policy "sv_insert_admin"
  on public.storefront_verifications
  for insert
  to authenticated
  with check (public.is_admin());

-- ── UPDATE ────────────────────────────────────────────────────────────────────

-- Admin only. Owners cannot change verification_status, reviewed_at, reviewed_by,
-- or notes — only moderators can advance the verification lifecycle.
create policy "sv_update_admin"
  on public.storefront_verifications
  for update
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- ── DELETE ────────────────────────────────────────────────────────────────────

-- Owner may withdraw a pending or rejected verification (to re-apply later).
-- Cannot delete an approved or expired verification — those are audit records.
create policy "sv_delete_owner"
  on public.storefront_verifications
  for delete
  to authenticated
  using (
    verification_status in ('pending', 'rejected')
    and exists (
      select 1 from public.storefronts
      where id       = storefront_id
        and owner_id = auth.uid()
    )
  );

-- Admin: can remove any record (e.g. fraudulent submission cleanup).
create policy "sv_delete_admin"
  on public.storefront_verifications
  for delete
  to authenticated
  using (public.is_admin());


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.storefront_verifications is
  'Audit trail for storefront trust verification. '
  'One row per (storefront_id, verification_type). '
  'storefronts.is_verified auto-synced by sync_storefront_is_verified() trigger: '
  'true if any approved verification exists, false otherwise. '
  'Types: phone, identity, business, local_verified.';

comment on column public.storefront_verifications.verification_type is
  'phone         — phone number confirmed (OTP or moderator call). '
  'identity      — owner CCCD/CMND sighted by moderator. '
  'business      — Giấy đăng ký kinh doanh confirmed. '
  'local_verified — VIO LOCAL community trust signal (moderator vouches in-person).';

comment on column public.storefront_verifications.verification_status is
  'pending  — submitted by owner, awaiting moderator review. '
  'approved — passed verification; triggers is_verified = true on storefront. '
  'rejected — failed; owner may delete and re-submit. '
  'expired  — previously approved but time-sensitive document has lapsed.';

comment on column public.storefront_verifications.reviewed_by is
  'Profile ID of the admin/moderator who reviewed this verification. '
  'NULL until reviewed. SET NULL on profile delete — preserves audit record. '
  'Must be set together with reviewed_at (enforced by review_consistency CHECK).';

comment on function public.sync_storefront_is_verified is
  'AFTER INSERT OR UPDATE OR DELETE trigger on storefront_verifications. '
  'Recomputes storefronts.is_verified = EXISTS (approved verification). '
  'SECURITY DEFINER so it can UPDATE storefronts regardless of caller RLS context.';
