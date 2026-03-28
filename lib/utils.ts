import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve
 * within `ms` milliseconds, it rejects with a TimeoutError.
 * Default timeout: 8 seconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: Operation did not complete within ${ms}ms`))
    }, ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/**
 * Wraps any async Supabase operation with a hard timeout.
 * If the operation doesn't resolve within `ms`, it rejects with a
 * clear "Connection lost" error. This prevents silent hangs when
 * the Supabase WebSocket/network is dead.
 * Default timeout: 10 seconds.
 */
export function safeSupabaseCall<T>(operation: () => Promise<T>, ms = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("CONNECTION_LOST: Operation timed out. Please check your connection and try again."))
    }, ms)
    operation().then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/**
 * Performs a lightweight connectivity check against Supabase.
 * Runs a minimal select with a hard 5-second timeout.
 * Returns true if connected, false otherwise.
 */
export async function checkSupabaseConnectivity(): Promise<boolean> {
  try {
    const { getSupabaseBrowserClient } = await import("./supabase-client")
    const supabase = getSupabaseBrowserClient()
    await withTimeout(
      supabase.from("cars").select("id").limit(1).then(() => true),
      5000,
    )
    return true
  } catch {
    return false
  }
}
