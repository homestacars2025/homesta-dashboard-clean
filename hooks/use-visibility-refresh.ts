"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * DATA REFRESH ONLY - Re-runs a callback when the browser tab becomes visible.
 *
 * IMPORTANT: This hook handles DATA REFRESH ONLY, not auth.
 * Auth is handled separately by Supabase's onAuthStateChange listener.
 *
 * Features:
 * - SINGLE refresh per visibility change (no duplicate triggers)
 * - Throttled to prevent rapid re-fetches (min 3s between calls)
 * - Skips refresh if a fetch is already in progress (via isFetching ref)
 * - 800ms delay to allow any background processes to settle
 * - Only listens for visibilitychange (removed focus listener to prevent duplicates)
 *
 * @param refresh - Callback to invoke on visibility restore (data fetch only)
 * @param isFetching - Optional ref to check if a fetch is in progress (skip if true)
 */
export function useVisibilityRefresh(
  refresh: () => void,
  isFetching?: React.MutableRefObject<boolean>
) {
  const ref = useRef(refresh)
  ref.current = refresh

  const lastRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false) // Prevent multiple triggers for same visibility event

  const triggerRefresh = useCallback(() => {
    console.log("[visibility-refresh] tab became visible")

    // Skip if a fetch is already in progress
    if (isFetching?.current) {
      console.log("[visibility-refresh] skipping — fetch already in progress")
      return
    }

    // Skip if we already have a pending refresh
    if (pendingRef.current) {
      console.log("[visibility-refresh] skipping — refresh already pending")
      return
    }

    const now = Date.now()
    // Throttle to 3 seconds between refreshes
    if (now - lastRef.current < 3000) {
      console.log("[visibility-refresh] skipping — throttled (last refresh was", now - lastRef.current, "ms ago)")
      return
    }

    // Mark as pending
    pendingRef.current = true
    console.log("[visibility-refresh] scheduling refresh in 800ms")

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current)

    // 800ms delay: gives auth-context time to complete async session validation
    timerRef.current = setTimeout(() => {
      pendingRef.current = false

      // Double-check fetching state after delay
      if (isFetching?.current) {
        console.log("[visibility-refresh] skipping after delay — fetch started during wait")
        return
      }

      lastRef.current = Date.now()
      console.log("[visibility-refresh] firing data refresh callback")

      try {
        ref.current()
      } catch (e) {
        console.error("[visibility-refresh] refresh callback threw:", e)
      }
    }, 800)
  }, [isFetching])

  useEffect(() => {
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh()
      } else {
        console.log("[visibility-refresh] tab hidden")
      }
    }

    document.addEventListener("visibilitychange", visibilityHandler)

    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [triggerRefresh])
}
