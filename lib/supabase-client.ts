"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.",
    )
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // detectSessionInURL must be true (the default) so that email-confirmation
      // links and OAuth redirect callbacks can exchange the URL token for a session.
      // Setting it to false was breaking those flows.
      detectSessionInURL: true,
      // persistSession + autoRefreshToken keep the session alive in localStorage
      // and silently renew it before it expires — no manual refresh needed.
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return client
}

// FIX: Utility to clear all Supabase auth storage. Called when the session
// is detected as corrupt/expired and cannot be refreshed. This forces a
// clean re-auth on next page load instead of an infinite loading spinner.
export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return
  const keys = Object.keys(localStorage)
  for (const key of keys) {
    if (key.startsWith("sb-") && (key.includes("-auth-token") || key.includes("supabase.auth"))) {
      localStorage.removeItem(key)
    }
  }
}
