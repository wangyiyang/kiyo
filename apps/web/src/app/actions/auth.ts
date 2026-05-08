'use server'

import { createServerClient } from '@kiyo/supabase/server'

export type AuthResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string }

export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return { ok: true }
}

export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return { ok: true, message: 'Please check your email to verify your account.' }
}

export async function signOut(): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return { ok: true, message: 'Login link sent! Check your email.' }
}

export async function sendResetPassword(email: string): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/reset-password`,
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return {
    ok: true,
    message: "If this email is registered, you'll receive a reset link.",
  }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return { ok: true, message: 'Password updated successfully.' }
}
