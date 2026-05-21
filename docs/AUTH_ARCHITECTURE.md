# VIO LOCAL — AUTH ARCHITECTURE
**Supabase Auth · Email-first · TanStack Start · Simple by design**

---

## 0. GUIDING PRINCIPLE

Auth is infrastructure, not a product. It should be invisible when it works and obvious when it fails. Every decision here optimises for:

1. **Simple to implement** — no custom token servers, no JWT libraries, no auth middleware frameworks
2. **Safe by default** — RLS at the DB layer, ownership checked server-side, no client-trust
3. **Easy to extend** — Google OAuth slots in without touching any existing code

Supabase handles the hard parts (token issuance, refresh, PKCE, email delivery). Our job is to wire it up cleanly.

---

## 1. AUTH FLOW

### 1.1 Sign Up (Email + Password)

```
User                     TanStack Start           Supabase Auth           Database
  │                            │                        │                     │
  │──── POST /auth/signup ────▶│                        │                     │
  │                            │── supabase.auth.signUp ▶│                     │
  │                            │                        │── INSERT auth.users  │
  │                            │                        │──────────────────────▶
  │                            │                        │   trigger fires      │
  │                            │                        │◀──────────────────────
  │                            │                        │   INSERT profiles    │
  │                            │                        │──────────────────────▶
  │                            │◀── { user, session } ──│                     │
  │                            │                        │                     │
  │                     (email unconfirmed)              │                     │
  │◀─── redirect /verify-email ─│                        │                     │
  │                            │                        │                     │
  │── clicks confirmation link ────────────────────────▶│                     │
  │                            │                        │── email_confirmed_at │
  │                            │◀── redirect /onboarding │                     │
```

**What happens at each step:**

1. User submits email + password
2. `supabase.auth.signUp()` creates a record in `auth.users` with `email_confirmed_at = NULL`
3. A database trigger fires on `auth.users` INSERT and creates a matching `profiles` row
4. Supabase sends a confirmation email automatically (configured in Supabase dashboard)
5. User clicks the link → `email_confirmed_at` is set → session is issued
6. User is redirected to `/onboarding` (first visit) or `/dashboard` (returning)

### 1.2 Sign In (Email + Password)

```
User                     TanStack Start           Supabase Auth
  │                            │                        │
  │──── POST /auth/login ─────▶│                        │
  │                            │── supabase.auth.signInWithPassword ──▶│
  │                            │◀── { session: { access_token,         │
  │                            │                refresh_token } }      │
  │                            │                        │
  │                     session stored in
  │                     localStorage (browser)
  │                     + cookie for SSR
  │◀─── redirect /dashboard ───│
```

Session storage is handled by the Supabase JS client automatically. For SSR, see Section 2.2.

### 1.3 Sign Out

```typescript
// Simple. Supabase clears tokens locally and invalidates server-side.
await supabase.auth.signOut()
// redirect to /
```

### 1.4 Google OAuth (Phase 2 — no code change required)

When ready, enable Google in the Supabase dashboard under Authentication → Providers. The existing sign-up trigger on `auth.users` fires identically for OAuth sign-ups. No application code changes needed.

```typescript
// Only addition needed when Google is enabled:
await supabase.auth.signInWithOAuth({ provider: 'google' })
```

The profile auto-creation trigger (Section 6.1) handles the `auth.users` INSERT from OAuth just as it does for email sign-ups.

---

## 2. SESSION HANDLING

### 2.1 Browser Session

The Supabase JS client manages session state in `localStorage`. It handles token refresh automatically before expiry.

```typescript
// src/hooks/useSession.ts
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '#/services/supabase/client'

export function useSession() {
  const supabase = createBrowserSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, user: session?.user ?? null }
}
```

### 2.2 Server-Side Session (TanStack Start SSR)

Server functions need to validate the session from the request. The access token travels as a cookie (`sb-access-token`) that the Supabase client sets automatically.

```typescript
// src/services/supabase/server-session.ts
import { createServerSupabaseClient } from '#/services/supabase/client'
import { getWebRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Get the authenticated user from a server function context.
 * Uses the access token from the Authorization header or cookie.
 * Returns null if unauthenticated — callers decide whether to throw.
 */
export async function getServerSession() {
  const request = getWebRequest()
  const authHeader = request?.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) return null

  // Verify the token with Supabase (validates against the JWT secret)
  const supabase = createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) return null
  return user
}
```

### 2.3 Root Context (TanStack Router)

Expose the session to the entire router tree via context. This powers `beforeLoad` checks without each route making its own auth call.

```typescript
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { createBrowserSupabaseClient } from '#/services/supabase/client'
import type { Session } from '@supabase/supabase-js'

export type RouterContext = {
  session: Session | null
}

async function getInitialContext(): Promise<RouterContext> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return { session: data.session }
}

export const router = createRouter({
  routeTree,
  context: await getInitialContext(),
})
```

---

## 3. PROTECTED ROUTE STRATEGY

All route protection uses TanStack Router's `beforeLoad`. No middleware, no HOCs, no wrappers.

### 3.1 The Rule

```
/dashboard/**   → requires session
/storefront/**  → requires session + merchant role
/admin/**       → requires session + admin role
Everything else → public
```

### 3.2 Shared Auth Guards

```typescript
// src/lib/auth-guards.ts
import { redirect } from '@tanstack/react-router'
import type { RouterContext } from '#/router'

export function requireSession({ context }: { context: RouterContext }) {
  if (!context.session) {
    throw redirect({ to: '/login', search: { next: location.pathname } })
  }
  return context.session
}

export function requireMerchant({ context }: { context: RouterContext }) {
  const session = requireSession({ context })
  // Role is stored in the JWT custom claim (set via DB hook — see Section 5.3)
  const role = session.user.user_metadata?.role ?? 'buyer'
  if (role !== 'merchant' && role !== 'admin') {
    throw redirect({ to: '/dashboard', search: { error: 'not_merchant' } })
  }
  return session
}

export function requireAdmin({ context }: { context: RouterContext }) {
  const session = requireSession({ context })
  const role = session.user.user_metadata?.role ?? 'buyer'
  if (role !== 'admin') {
    throw redirect({ to: '/dashboard' })
  }
  return session
}
```

### 3.3 Usage in Routes

```typescript
// src/routes/dashboard/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '#/lib/auth-guards'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: requireSession,
  component: DashboardPage,
})

// src/routes/dashboard/storefront/$storefrontId.tsx
export const Route = createFileRoute('/dashboard/storefront/$storefrontId')({
  beforeLoad: requireMerchant,
  component: StorefrontEditPage,
})
```

### 3.4 Redirect After Login

Login page reads the `next` param and redirects after successful sign-in:

```typescript
// src/routes/login.tsx
export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    next: (search.next as string) ?? '/dashboard',
  }),
  component: LoginPage,
})

// In the login form submit handler:
async function handleLogin(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error) router.navigate({ to: search.next })
}
```

---

## 4. OWNERSHIP VALIDATION

RLS is the enforcement layer. Server functions validate ownership before mutating data.

### 4.1 The Two-Layer Model

```
Layer 1 — RLS (database):
  Enforces at query time. Cannot be bypassed by application code.
  "Does the current JWT's user_id own this row?"

Layer 2 — Server function (application):
  Explicit check before accepting user intent.
  "Is the user trying to act on something they own?"

Never trust Layer 2 alone. Never skip Layer 1 for owned resources.
```

### 4.2 Storefront Ownership Check

```typescript
// src/services/ownership.ts
import { createServerFn } from '@tanstack/react-start'
import { createServerSupabaseClient } from '#/services/supabase/client'
import { getServerSession } from '#/services/supabase/server-session'

/**
 * Verify the current user owns a storefront.
 * Throws if unauthenticated or not the owner.
 * Returns the storefront record on success.
 */
export const requireStorefrontOwner = createServerFn()
  .validator((storefrontId: string) => storefrontId)
  .handler(async ({ data: storefrontId }) => {
    const user = await getServerSession()
    if (!user) throw new Error('UNAUTHENTICATED')

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('storefronts')
      .select('id, owner_id, status')
      .eq('id', storefrontId)
      .single()

    if (error || !data) throw new Error('NOT_FOUND')
    if (data.owner_id !== user.id) throw new Error('FORBIDDEN')

    return data
  })
```

### 4.3 Listing Ownership Check

Products, services, and land listings all store `owner_id` directly (denormalized from the storefront). The same pattern applies:

```typescript
export const requireListingOwner = createServerFn()
  .validator((input: { table: 'products' | 'services' | 'land_listings', id: string }) => input)
  .handler(async ({ data }) => {
    const user = await getServerSession()
    if (!user) throw new Error('UNAUTHENTICATED')

    const supabase = createServerSupabaseClient()
    const { data: row, error } = await supabase
      .from(data.table)
      .select('id, owner_id')
      .eq('id', data.id)
      .single()

    if (error || !row) throw new Error('NOT_FOUND')
    if (row.owner_id !== user.id) throw new Error('FORBIDDEN')

    return row
  })
```

### 4.4 What RLS Already Handles (No Application Code Needed)

| Operation | RLS handles it |
|---|---|
| Reading someone else's draft listing | ✓ Blocked — drafts only visible to owner |
| Selecting another user's saved items | ✓ Blocked — `user_id = auth.uid()` |
| Inserting a product into another's storefront | ✓ Blocked — `owner_id = auth.uid()` check |
| Reading another user's inquiries | ✓ Blocked — sender/recipient check |

For these operations, no application-level ownership check is required — the DB rejects the query before it executes.

---

## 5. ROLE MODEL

### 5.1 Four Roles

| Role | Description | Can do |
|---|---|---|
| `buyer` | Default for all new accounts | Browse, save items, send inquiries |
| `merchant` | Upgraded when a storefront is created | Everything buyer can do + create/manage storefronts, list products/services/land |
| `moderator` | Assigned by admin | Review flagged content, manage listing status |
| `admin` | Platform operator | Full access, can assign roles, manage users |

**Start everyone as `buyer`.** There is no sign-up form for merchant role. The role upgrades automatically (see 5.2).

### 5.2 Merchant Role Upgrade

A user becomes a `merchant` when they create their first storefront. This happens inside the storefront creation server function:

```typescript
// src/services/storefronts/create.ts
export const createStorefront = createServerFn()
  .handler(async ({ data }) => {
    const user = await getServerSession()
    if (!user) throw new Error('UNAUTHENTICATED')

    const supabase = createServerSupabaseClient()

    // Create the storefront
    const { data: storefront, error } = await supabase
      .from('storefronts')
      .insert({ ...data, owner_id: user.id })
      .select()
      .single()

    if (error) throw error

    // Upgrade the user's role if they're still a buyer
    await supabase
      .from('profiles')
      .update({ role: 'merchant' })
      .eq('user_id', user.id)
      .eq('role', 'buyer')  // only upgrade, never downgrade

    return storefront
  })
```

### 5.3 Role in the JWT (For Client-Side Guards)

Supabase allows injecting custom claims into the JWT via a database hook. This avoids an extra DB round-trip on every route check.

```sql
-- In Supabase dashboard: Database → Hooks → JWT claims hook
-- Or via SQL:

CREATE OR REPLACE FUNCTION custom_jwt_claims(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  profile_role user_role;
BEGIN
  SELECT role INTO profile_role
  FROM profiles
  WHERE user_id = (event->>'user_id')::UUID;

  RETURN jsonb_set(
    event,
    '{claims,user_metadata,role}',
    to_jsonb(profile_role::text)
  );
END;
$$;
```

After this hook is set, `session.user.user_metadata.role` is always current as of the last token refresh (≤1 hour). This is accurate enough for UI guards. RLS at the DB layer is always authoritative.

### 5.4 Role Hierarchy in RLS

```sql
-- Convenience function used in RLS policies
CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$;

-- Hierarchy check: admin > moderator > merchant > buyer
CREATE OR REPLACE FUNCTION auth.has_role_or_above(minimum user_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT CASE auth.current_role()
    WHEN 'admin'     THEN true
    WHEN 'moderator' THEN minimum IN ('buyer', 'merchant', 'moderator')
    WHEN 'merchant'  THEN minimum IN ('buyer', 'merchant')
    WHEN 'buyer'     THEN minimum = 'buyer'
    ELSE false
  END
$$;
```

---

## 6. PROFILE LIFECYCLE

### 6.1 Auto-Creation Trigger

A profile row is created automatically the moment a user is added to `auth.users`. This is a database trigger — not application code. No sign-up handler, no webhook, no async queue.

```sql
-- Migration 0004_profiles.sql (or a dedicated trigger migration)

CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    'buyer',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',  -- set by Google OAuth
      split_part(NEW.email, '@', 1)          -- fallback: email prefix
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_new_user();
```

This trigger fires for **all** sign-up methods: email/password, Google OAuth, any future provider. Zero application code handles profile creation.

### 6.2 Profile Completion States

```
NEW USER
  │
  ▼
[incomplete]  — only user_id + role + display_name (from trigger)
  │
  ▼
[basic]       — display_name confirmed, phone added (optional)
  │
  ▼
[verified]    — is_verified = true (manual or future phone OTP)
  │
  ▼
[merchant]    — role upgraded, has at least one storefront
```

The application checks `profile.display_name` to decide whether to show the onboarding screen. No separate `onboarding_completed` flag needed.

### 6.3 Profile Data Owned by Auth vs Profiles

| Data | Stored in | Managed by |
|---|---|---|
| Email address | `auth.users.email` | Supabase (email change flow) |
| Password | `auth.users` (hashed) | Supabase |
| Email confirmed | `auth.users.email_confirmed_at` | Supabase |
| Display name | `profiles.display_name` | Application |
| Phone | `profiles.phone` | Application |
| Role | `profiles.role` | Application (DB trigger for upgrade) |
| Avatar | `profiles.avatar_url` | Application (Supabase Storage) |

**Rule:** Never write to `auth.users` directly from application code. Use `supabase.auth.updateUser()` for email/password changes.

---

## 7. ONBOARDING FLOW

Onboarding is shown once: when a user has a session but an incomplete profile.

### 7.1 Decision Tree

```
User lands on any page
        │
        ▼
   Has session?
   ┌──No──┐
   │      │
   ▼      ▼
public  /login
page
        │
        ▼
   display_name
   is set?
   ┌──No──┐
   │      │
   ▼      ▼
/onboarding  /dashboard (or intended route)
```

### 7.2 Onboarding Steps

Three screens. No skip option for Step 1.

```
STEP 1 — "What should we call you?"  (required)
  Input: display_name
  Saves to: profiles.display_name
  Validation: 2–100 chars, non-empty

STEP 2 — "Add your phone number"  (optional, skippable)
  Input: phone  (Vietnamese format: 09xxxxxxxx)
  Saves to: profiles.phone
  Skip label: "I'll add this later"

STEP 3 — "Do you have a business to list?"  (choice)
  Option A: "Yes, I want to list my business"
    → redirect /dashboard/storefront/new
    → role upgrade to merchant happens on storefront creation
  Option B: "Just browsing"
    → redirect /dashboard
```

### 7.3 Onboarding Route Guard

```typescript
// src/routes/onboarding.tsx
export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    // Must be logged in to onboard
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => {
    // Load current profile to pre-fill any existing data
    const supabase = createBrowserSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, phone')
      .eq('user_id', user!.id)
      .single()
    return { profile }
  },
  component: OnboardingPage,
})
```

### 7.4 Redirect Logic (Root Layout)

Check for incomplete onboarding in the root layout, not in every protected route:

```typescript
// src/routes/__root.tsx
export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    // Skip this check on auth and onboarding pages
    const isAuthRoute = location.pathname.startsWith('/login') ||
                        location.pathname.startsWith('/signup') ||
                        location.pathname.startsWith('/onboarding') ||
                        location.pathname.startsWith('/verify-email')

    if (isAuthRoute || !context.session) return

    // Check profile completion (cached in session for performance)
    const supabase = createBrowserSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', context.session.user.id)
      .single()

    if (!profile?.display_name) {
      throw redirect({ to: '/onboarding' })
    }
  },
})
```

---

## 8. QUICK REFERENCE

### Routes and Their Auth Requirements

| Route | Auth Required | Role Required |
|---|---|---|
| `/` | No | — |
| `/:province/:district/*` | No | — |
| `/login` `/signup` | No (redirect if session) | — |
| `/onboarding` | Session | — |
| `/dashboard` | Session | `buyer` |
| `/dashboard/storefront/new` | Session | — (upgrades on create) |
| `/dashboard/storefront/:id` | Session | `merchant` + owner |
| `/dashboard/listing/:id` | Session | `merchant` + owner |
| `/admin/*` | Session | `admin` |

### Key Functions and Where They Live

| Function | File | Purpose |
|---|---|---|
| `createBrowserSupabaseClient()` | `src/services/supabase/client.ts` | Browser auth client |
| `createServerSupabaseClient()` | `src/services/supabase/client.ts` | Server-side service role client |
| `getServerSession()` | `src/services/supabase/server-session.ts` | Extract user from server request |
| `requireSession()` | `src/lib/auth-guards.ts` | Route guard: must be logged in |
| `requireMerchant()` | `src/lib/auth-guards.ts` | Route guard: must be merchant |
| `requireStorefrontOwner()` | `src/services/ownership.ts` | Server fn: must own storefront |
| `requireListingOwner()` | `src/services/ownership.ts` | Server fn: must own listing |
| `useSession()` | `src/hooks/useSession.ts` | React hook: live session state |

### What Supabase Handles (Don't Reinvent)

- Password hashing and comparison
- Token issuance, signing, expiry
- Access token refresh (every 60 min)
- Confirmation emails
- Password reset emails
- OAuth PKCE flow
- Session invalidation on sign-out

---

**END OF AUTH_ARCHITECTURE.md v1.0**

*Auth is the lock on the door. RLS is the vault. Both must hold. If they conflict, RLS wins.*
