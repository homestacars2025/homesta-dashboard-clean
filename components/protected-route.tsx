"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

// Routes that investors are NOT allowed to access
const INVESTOR_FORBIDDEN_ROUTES = [
  "/general", // General overview dashboard
  "/dashboard/bookings",
  "/dashboard/operations",
  "/dashboard/users",
]

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ("admin" | "staff" | "investor" | "customer")[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, initialAuthChecked } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  console.log("[protected-route] render —", pathname, "| user:", user ? user.id : "null", "| isLoading:", isLoading, "| initialAuthChecked:", initialAuthChecked)

  // Grace period timer: we never redirect immediately when user becomes null.
  // This prevents redirects during Supabase token refresh cycles where
  // SIGNED_OUT fires before SIGNED_IN arrives (a known Supabase SDK behavior).
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    // ONLY redirect if auth has fully resolved AND there is no user.
    if (!initialAuthChecked) return
    if (isLoading) return

    if (!user) {
      // Start a 3s grace period before redirecting.
      // This is long enough for the full Supabase token-refresh cycle:
      //   SIGNED_IN (new token) → SIGNED_OUT (old session cleanup) → user restored
      // The auth-context SIGNED_OUT debounce (2s) + lastValidAuthRef guard
      // should prevent setUser(null) from firing, but this provides a final
      // safety net in case they don't.
      if (!redirectTimerRef.current && !hasRedirectedRef.current) {
        console.log("[protected-route] user is null — starting 3s grace period before redirect")
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null
          console.log("[protected-route] grace period elapsed — redirecting to /login")
          hasRedirectedRef.current = true
          router.replace("/login")
        }, 3000)
      }
      return
    }

    // User is present — cancel any pending redirect
    if (redirectTimerRef.current) {
      console.log("[protected-route] user restored — cancelling pending redirect")
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }
    hasRedirectedRef.current = false

    // Check role-based access
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect to appropriate page based on role
      if (user.role === "investor") {
        router.replace("/dashboard/cars")
      } else {
        router.replace("/general")
      }
      return
    }

    // For investors, check route permissions
    if (user.role === "investor") {
      const isForbidden = INVESTOR_FORBIDDEN_ROUTES.some(
        (route) => pathname === route || (route !== "/general" && pathname.startsWith(route + "/"))
      )
      const isExactGeneral = pathname === "/general"

      if (isForbidden || isExactGeneral) {
        router.replace("/dashboard/cars")
        return
      }
    }
  }, [user, isLoading, initialAuthChecked, router, pathname, allowedRoles])

  // Cancel redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  // Determine whether to show the overlay spinner
  const showOverlay = isLoading || !initialAuthChecked || !user

  // Check if user has required role (show nothing while redirecting)
  const hasRequiredRole = !user || !allowedRoles || allowedRoles.includes(user.role)

  // For investors on forbidden routes (show nothing while redirecting)
  const investorForbidden = user?.role === "investor" && (() => {
    const isForbidden = INVESTOR_FORBIDDEN_ROUTES.some(
      (route) => pathname === route || (route !== "/general" && pathname.startsWith(route + "/"))
    )
    return isForbidden || pathname === "/general"
  })()

  // KEY FIX: Always render {children} — never conditionally unmount them.
  // An overlay spinner is shown on top when auth is not yet resolved.
  // This prevents the entire page component from unmounting during Supabase
  // token refresh cycles, which would destroy all component state and cause
  // the "data disappears on tab switch" bug.
  return (
    <>
      {/* Always render children to preserve component state during auth transitions */}
      {hasRequiredRole && !investorForbidden && children}

      {/* Overlay spinner: covers children without unmounting them */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-3 rounded-full mx-auto mb-3" style={{ borderColor: "#e2e8f0", borderTopColor: "#5BC0F8" }} />
            <p className="text-slate-400 text-xs">Loading...</p>
          </div>
        </div>
      )}
    </>
  )
}
