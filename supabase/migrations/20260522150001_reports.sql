-- =============================================================================
-- VIO LOCAL — Reports
-- =============================================================================
-- Purpose: Lightweight user reporting for storefronts, products, services,
-- and land listings. Not a trust-and-safety pipeline. Not a social moderation
-- system. A record that "this user flagged this content, for this reason."
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--
-- Anonymous vs. authenticated reporters:
--   reporter_profile_id is NULLABLE. Unauthenticated (anon) users may submit
--   reports with reporter_profile_id = NULL. Authenticated users must attach
--   their own profile_id — the INSERT RLS policy enforces this.
--   Edge-level rate limiting (Cloudflare / Supabase Edge Function middleware)
--   is required to prevent anonymous report flooding — not in this table.
--
--   reporter_profile_id: ON DELETE SET NULL — preserves the report audit trail
--   even if the reporter later deletes their account.
--
-- Fields added beyond spec — reviewed_by + reviewed_at:
--   Same pattern as storefront_verifications.sql. The spec omits these but
--   they are essential: without reviewer tracking, admins cannot audit who
--   closed a report or when. Both must be set or both null (consistency CHECK).
--
-- No FK on target_id:
--   Same reasoning as inquiries.sql and saved_items.sql. Referential integrity
--   across four entity tables is not expressible as a single FK. If a reported
--   entity is later deleted, the report row is preserved as an audit record.
--   The admin UI handles missing entities gracefully ("entity no longer exists").
--
-- Spam prevention:
--   Partial UNIQUE on (reporter_profile_id, target_type, target_id)
--   WHERE reporter_profile_id IS NOT NULL prevents the same authenticated user
--   from filing duplicate reports against the same entity.
--   Anonymous duplicate reports are not DB-constrained — rely on edge rate limiting.
-- =============================================================================


-- ── TABLE ─────────────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id                  uuid         not null default gen_random_uuid(),

  -- NULL = anonymous report. SET NULL on profile delete — preserves audit trail.
  reporter_profile_id uuid,

  target_type         varchar(20)  not null,
  target_id           uuid         not null,
  reason              varchar(30)  not null,

  -- Reporter's optional free-text context. Required by application layer
  -- when reason = 'other'. No DB enforcement — notes may be null for any reason.
  notes               text,

  status              varchar(20)  not null default 'pending',

  -- ── Reviewer fields — not in spec, added for audit trail ──────────────────
  -- Which admin reviewed this report. SET NULL on profile delete — preserves
  -- the report record even if the reviewer account is removed.
  reviewed_by         uuid,
  -- When the report was first reviewed (status moved off 'pending').
  reviewed_at         timestamptz,

  created_at          timestamptz  not null default now(),

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint reports_pkey
    primary key (id),

  -- Reporter FK: SET NULL preserves the report when the account is deleted.
  -- A deleted account's reports remain in the audit trail with reporter = NULL.
  constraint reports_reporter_fk
    foreign key (reporter_profile_id) references public.profiles(id)
    on delete set null,

  -- Reviewer FK: SET NULL if the admin account is removed.
  constraint reports_reviewer_fk
    foreign key (reviewed_by) references public.profiles(id)
    on delete set null,

  -- Supported entity types. Must stay in sync with:
  --   inquiries_target_type_check   (20260522120001_inquiries.sql)
  --   saved_items_target_type_check (20260522140001_saved_items.sql)
  -- To add a new type: DROP + re-add this constraint in a new migration.
  constraint reports_target_type_check
    check (target_type in ('storefront', 'product', 'service', 'land_listing')),

  -- Reason vocabulary — intentionally narrow.
  -- 'other' is a catch-all; application layer should require notes when used.
  -- To add a new reason: DROP + re-add this constraint in a new migration.
  constraint reports_reason_check
    check (reason in (
      'spam',            -- fake listing, duplicate, bot-generated
      'fake_info',       -- incorrect price, wrong location, fabricated identity
      'inappropriate',   -- offensive or explicit content / images
      'scam',            -- fraudulent pricing, non-existent product
      'wrong_category',  -- misclassified listing (e.g. product filed as service)
      'other'            -- anything else — notes field should explain
    )),

  -- Status lifecycle:
  --   pending  → reviewed  (admin opens the report)
  --   reviewed → resolved  (admin took action: hid content, warned owner, etc.)
  --   reviewed → rejected  (admin dismissed as invalid or duplicate)
  --
  -- 'resolved' and 'rejected' are terminal states.
  -- Re-opening a resolved report requires a new report row, not a status reset.
  constraint reports_status_check
    check (status in ('pending', 'reviewed', 'resolved', 'rejected')),

  -- reviewed_at and reviewed_by must both be set or both be null.
  -- Prevents half-reviewed rows where only one field was written.
  constraint reports_review_consistency
    check (
      (reviewed_at is null and reviewed_by is null)
      or
      (reviewed_at is not null and reviewed_by is not null)
    )
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Moderation queue: pending reports, FIFO (oldest first — fairest review order).
-- Partial index — only pending rows are in the index, keeping it small and fast.
create index if not exists idx_reports_pending_queue
  on public.reports(created_at asc)
  where status = 'pending';

-- Entity reports view: "how many times has this entity been reported?"
-- Supports admin UI overview and automated flagging (e.g. hide after N reports).
create index if not exists idx_reports_target
  on public.reports(target_type, target_id, status);

-- Reporter abuse detection: "has this user filed an unusual volume of reports?"
-- Partial index — anonymous rows (NULL) excluded; they can't be looked up by id.
create index if not exists idx_reports_reporter
  on public.reports(reporter_profile_id)
  where reporter_profile_id is not null;

-- Reviewer audit: which reports did a specific admin handle?
create index if not exists idx_reports_reviewer
  on public.reports(reviewed_by)
  where reviewed_by is not null;


-- ── PARTIAL UNIQUE INDEX — no duplicate reports from same authenticated user ──
--
-- Prevents an authenticated user from filing the same report twice against the
-- same entity. Anonymous reports (reporter_profile_id IS NULL) are excluded —
-- they cannot be uniquely identified, so rely on edge-level rate limiting instead.
create unique index if not exists idx_reports_unique_authenticated
  on public.reports(reporter_profile_id, target_type, target_id)
  where reporter_profile_id is not null;


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.reports enable row level security;

-- ── SELECT ────────────────────────────────────────────────────────────────────

-- Authenticated reporters: see their own reports only.
-- Allows a reporter to check the status of their filed report.
-- Does NOT allow reading other users' reports (prevents enumerating targets).
create policy "reports_select_own"
  on public.reports
  for select
  to authenticated
  using (reporter_profile_id = auth.uid());

-- Admin: unrestricted read for moderation queue and audit.
create policy "reports_select_admin"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());

-- Note: anon reporters have NO SELECT policy.
-- Once submitted anonymously, the report cannot be re-read by the submitter.
-- This is intentional — same pattern as inquiries (senders have no SELECT).

-- ── INSERT ────────────────────────────────────────────────────────────────────

-- Anyone (anon or authenticated) may file a report.
-- WITH CHECK rules:
--   Authenticated: reporter_profile_id must equal auth.uid() — no spoofing.
--   Anonymous:     reporter_profile_id must be NULL — cannot claim an identity.
--   Both:          status must start as 'pending'; reviewer fields must be null.
create policy "reports_insert_public"
  on public.reports
  for insert
  to anon, authenticated
  with check (
    (
      -- Authenticated user attaches their own profile_id
      (auth.uid() is not null and reporter_profile_id = auth.uid())
      or
      -- Unauthenticated user leaves reporter_profile_id null
      (auth.uid() is null and reporter_profile_id is null)
    )
    and status      = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Admin: may insert reports directly (e.g. proactive moderation, bulk import).
create policy "reports_insert_admin"
  on public.reports
  for insert
  to authenticated
  with check (public.is_admin());

-- ── UPDATE ────────────────────────────────────────────────────────────────────

-- Admin only. Reporters cannot change status, reviewed_by, or reviewed_at.
-- Only moderators advance the report lifecycle.
create policy "reports_update_admin"
  on public.reports
  for update
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- ── DELETE ────────────────────────────────────────────────────────────────────

-- Admin only. Reports are audit records — reporters cannot retract them.
-- Admin may delete invalid or spam reports (e.g. mass-report attack cleanup).
create policy "reports_delete_admin"
  on public.reports
  for delete
  to authenticated
  using (public.is_admin());


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.reports is
  'User-submitted content reports across storefronts, products, services, land_listings. '
  'reporter_profile_id is nullable: NULL = anonymous reporter. '
  'No FK on target_id — entity may be deleted after report is filed; admin UI handles gracefully. '
  'Partial UNIQUE (reporter_profile_id, target_type, target_id) WHERE reporter_profile_id IS NOT NULL '
  'prevents duplicate authenticated reports. Anonymous duplicates rely on edge rate limiting.';

comment on column public.reports.reporter_profile_id is
  'Profile ID of the reporter. NULL for anonymous reports. '
  'SET NULL on profile delete — preserves audit trail when account is removed. '
  'Authenticated INSERT policy enforces reporter_profile_id = auth.uid(). '
  'Anonymous INSERT policy enforces reporter_profile_id IS NULL.';

comment on column public.reports.target_id is
  'UUID of the reported entity (storefront, product, service, or land_listing). '
  'No FK constraint — integrity across four tables is not expressible as a single FK. '
  'If the entity is deleted after the report is filed, the report row is preserved. '
  'Admin UI should query the entity and handle missing entities gracefully.';

comment on column public.reports.reason is
  'spam         — fake listing, duplicate, bot-generated content. '
  'fake_info    — incorrect price, wrong location, fabricated identity. '
  'inappropriate — offensive or explicit content / images. '
  'scam         — fraudulent pricing, non-existent product. '
  'wrong_category — misclassified listing. '
  'other        — catch-all; application layer should require notes when used.';

comment on column public.reports.status is
  'pending  — submitted, awaiting moderator review. '
  'reviewed — admin has opened the report but not yet acted. '
  'resolved — admin took action (hid content, warned owner, etc.). '
  'rejected — admin dismissed as invalid or duplicate. '
  'resolved and rejected are terminal states. Re-open by filing a new report.';

comment on column public.reports.reviewed_by is
  'Profile ID of the admin/moderator who reviewed this report. '
  'NULL until reviewed. SET NULL on profile delete — preserves audit record. '
  'Must be set together with reviewed_at (enforced by reports_review_consistency CHECK).';

comment on column public.reports.notes is
  'Free-text context from the reporter. '
  'Application layer should require notes when reason = ''other''. '
  'No DB enforcement — notes may be null for any reason value.';
