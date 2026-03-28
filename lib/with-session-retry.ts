"use client"

import { getSupabaseBrowserClient, clearSupabaseAuthStorage } from "./supabase-client"

/**
 * Detects whether an error is a 400 or 404 (table not found, bad request).
 * These should NOT be retried - they indicate missing tables or bad queries.
 */
function isNonRetryableError(err: any): boolean {
  if (!err) return false
  const status = err?.status || err?.code
  const msg = (err?.message || err?.error_description || "").toLowerCase()
  return (
    status === 400 ||
    status === 404 ||
    status === "PGRST116" || // Table not found
    status === "42P01" || // PostgreSQL relation does not exist
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("not found") ||
    msg.includes("bad request")
  )
}

/**
 * Detects whether a Supabase error is DEFINITELY an auth/session error.
 *
 * IMPORTANT: This must be conservative. Do NOT match on broad terms like
 * "session", "token", or 403 (which can be RLS errors, not auth errors).
 * Only match on errors that definitively mean the session is invalid.
 */
function isAuthError(err: any): boolean {
  if (!err) return false
  const msg = (err?.message || err?.error_description || "").toLowerCase()
  return (
    err?.status === 401 ||
    err?.code === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("not authenticated")
  )
}

/**
 * Forces logout and redirects to login page.
 * Only call this when session is CONFIRMED permanently invalid.
 *
 * NOTE: This is now only exported for explicit use — withSessionRetry
 * no longer calls it automatically on network errors.
 */
export async function forceLogoutAndRedirect() {
  if (typeof window === "undefined") return
  console.warn("[auth] forceLogoutAndRedirect called — clearing session and redirecting to /login")

  try {
    const supabase = getSupabaseBrowserClient()
    clearSupabaseAuthStorage()
    await supabase.auth.signOut({ scope: "local" })
  } catch {
    // Ignore errors during signout
  }

  // Redirect to login
  window.location.href = "/login"
}

/**
 * Wraps any async function that queries Supabase. If the query fails
 * with a definitive auth error (401, invalid JWT), it silently refreshes
 * the session and retries the query once.
 *
 * IMPORTANT: This NO LONGER calls forceLogoutAndRedirect on failure.
 * Forced logout was causing users to be logged out on transient network
 * errors (e.g. when returning to an inactive tab). Now it just throws
 * the error and lets the caller handle it gracefully.
 */
export async function withSessionRetry<T>(queryFn: () => Promise<T>): Promise<T> {
  try {
    const result = await queryFn()

    // Supabase queries return { data, error } — check the error field
    const asAny = result as any
    if (asAny?.error) {
      // If it's a 400/404 error, return the result as-is (don't retry)
      if (isNonRetryableError(asAny.error)) {
        return result
      }
      if (isAuthError(asAny.error)) {
        throw asAny.error
      }
    }

    return result
  } catch (err) {
    // If it's a non-retryable error (400/404), don't retry - just throw
    if (isNonRetryableError(err)) throw err
    if (!isAuthError(err)) throw err

    console.warn("[auth] withSessionRetry: auth error detected, attempting silent token refresh", err)

    // Attempt silent session refresh
    const supabase = getSupabaseBrowserClient()
    const { error: refreshError } = await supabase.auth.refreshSession()

    if (refreshError) {
      // Refresh failed — throw the error. Do NOT force logout automatically.
      // The user may just have a transient network issue. Supabase's own
      // autoRefreshToken will retry when connectivity is restored.
      console.warn("[auth] withSessionRetry: token refresh failed, throwing error (NOT logging out)", refreshError)
      throw err
    }

    // Retry the query with the refreshed token
    console.log("[auth] withSessionRetry: token refreshed, retrying query")
    return await queryFn()
  }
}

/**
 * Handles API response errors. If the response is 401 Unauthorized,
 * forces logout and redirect to login page.
 */
export function handleApiError(response: Response) {
  if (response.status === 401) {
    forceLogoutAndRedirect()
    return true
  }
  return false
}

/**
 * Safely executes a Supabase query. If the query fails with 400/404
 * (table not found, bad request), returns null instead of throwing.
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  try {
    const result = await queryFn()

    if (result.error) {
      // If 400/404, return null silently - don't retry, don't throw
      if (isNonRetryableError(result.error)) {
        return null
      }
      // For other errors, throw to let caller handle
      throw result.error
    }

    return result.data
  } catch (err) {
    // If it's a non-retryable error, return null silently
    if (isNonRetryableError(err)) {
      return null
    }
    throw err
  }
}
