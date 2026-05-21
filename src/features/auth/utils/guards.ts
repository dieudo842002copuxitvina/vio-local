import { redirect } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import type { UserRole } from '../types'

// RouterContext matches the shape used in router.tsx.
// Extend this interface when adding more context fields.
interface RouterContext {
  session: Session | null
}

interface GuardArgs {
  context: RouterContext
  location?: { pathname: string }
}

function roleFromSession(session: Session): UserRole {
  return (session.user.user_metadata?.role as UserRole) ?? 'buyer'
}

// ---------------------------------------------------------------------------
// Use these as beforeLoad handlers in TanStack Router route definitions.
//
// Example:
//   export const Route = createFileRoute('/dashboard')({
//     beforeLoad: requireSession,
//     component: DashboardPage,
//   })
// ---------------------------------------------------------------------------

export function requireSession({ context, location }: GuardArgs) {
  if (!context.session) {
    throw redirect({
      to: '/login',
      search: { next: location?.pathname ?? '/dashboard' },
    })
  }
  return context.session
}

export function requireMerchant(args: GuardArgs) {
  const session = requireSession(args)
  const role = roleFromSession(session)
  if (role !== 'merchant' && role !== 'admin') {
    throw redirect({ to: '/dashboard' })
  }
  return session
}

export function requireAdmin(args: GuardArgs) {
  const session = requireSession(args)
  const role = roleFromSession(session)
  if (role !== 'admin') {
    throw redirect({ to: '/dashboard' })
  }
  return session
}

// Redirect already-authenticated users away from /login and /signup
export function redirectIfAuthenticated({ context }: GuardArgs) {
  if (context.session) {
    throw redirect({ to: '/dashboard' })
  }
}
