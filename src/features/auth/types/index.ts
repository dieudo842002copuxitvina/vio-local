import type { Session, User } from '@supabase/supabase-js'

export type { Session, User }

// Mirrors the public.user_role enum in the database
export type UserRole = 'buyer' | 'merchant' | 'moderator' | 'admin'

// Mirrors public.profiles row
export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  bio: string | null
  province_id: number | null
  district_id: number | null
  ward_id: number | null
  created_at: string
  updated_at: string
}

// Mirrors public.user_roles row
export interface UserRoleRow {
  id: string
  user_id: string
  role: UserRole
  granted_by: string | null
  created_at: string
  updated_at: string
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  email: string
  password: string
}

// Replace with generated Database type after running:
//   npx supabase gen types typescript --linked > src/types/database.ts
export type Database = unknown
