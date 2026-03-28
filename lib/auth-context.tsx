"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import type { User } from "./types"
import { getSupabaseBrowserClient, clearSupabaseAuthStorage } from "./supabase-client"
import { Session } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  initialAuthChecked: boolean
  // Increments after every confirmed auth stabilisation (checkSession, SIGNED_IN,
  // TOKEN_REFRESHED). Pages subscribe to this so they load data AFTER the auth
  // token is valid — not during a concurrent token refresh.
  authVersion: number
  login: (email: string, password: string) => Promise<"success" | "pending" | "failed">
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [initialAuthChecked, setInitialAuthChecked] = useState(false)
  const [authVersion, setAuthVersion] = useState(0)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)

  // Ref to track current user inside visibility handler (closures can't see state updates)
  const userRef = useRef<User | null>(null)
  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null)

  // Debounce timer for SIGNED_OUT — Supabase can emit SIGNED_OUT then immediately
  // SIGNED_IN during a token refresh cycle. We delay acting on SIGNED_OUT so a
  // follow-up SIGNED_IN can cancel it.
  const signedOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timestamp of the last confirmed valid auth event (SIGNED_IN or TOKEN_REFRESHED).
  // Used to suppress spurious SIGNED_OUT events that arrive AFTER a valid SIGNED_IN —
  // this is the order @supabase/ssr emits on tab focus when the access token has expired:
  //   SIGNED_IN (session recovered) → SIGNED_OUT (old session invalidated)
  // Without this guard, the 1-second SIGNED_OUT debounce fires after SIGNED_IN has
  // already confirmed a valid user, incorrectly clearing the user state.
  const lastValidAuthRef = useRef<number>(0)

  if (!supabaseRef.current) {
    try {
      supabaseRef.current = getSupabaseBrowserClient()
    } catch (error: any) {
      // Silent fail - will show error UI
    }
  }

  const supabase = supabaseRef.current

  // Keep ref in sync so the visibility handler always sees the latest value
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (!supabase) {
      setSupabaseError("Supabase not configured")
      setIsLoading(false)
      return
    }

    let isMounted = true

    const loadProfile = async (userId: string, userEmail: string) => {
      console.log("[auth] loadProfile: fetching profile for user", userId)

      // Cast to explicit type: database.types.ts does not declare the profiles
      // table, so Supabase infers the result as `never`. The cast gives TypeScript
      // the correct shape without changing runtime behaviour.
      type ProfileRow = {
        id: string
        email: string | null
        full_name: string | null
        role: string
        avatar_url: string | null
        status: string | null
      }
      const { data: profile, error: profileError } = await (
        supabase.from("profiles").select("*").eq("id", userId).single() as unknown as Promise<{
          data: ProfileRow | null
          error: any
        }>
      )

      console.log("[auth] loadProfile: raw profile from DB →", profile, "| error →", profileError)

      if (!isMounted || !profile) {
        console.log("[auth] loadProfile: not mounted or no profile, skipping")
        return
      }

      console.log("[auth] loadProfile: profile.role =", profile.role)

      let investorId: string | undefined = undefined
      if (profile.role === "investor") {
        const { data: investorData } = await (
          supabase.from("investors").select("id").eq("profile_id", profile.id).single() as unknown as Promise<{
            data: { id: string } | null
            error: any
          }>
        )
        if (investorData) investorId = investorData.id
      }

      if (!isMounted) return
      console.log("[auth] loadProfile: setting user", profile.id, "role:", profile.role)
      setUser({
        id: profile.id,
        email: profile.email || userEmail,
        name: profile.full_name || "",
        role: profile.role as "admin" | "staff" | "investor" | "customer",
        investorId,
        avatar_url: profile.avatar_url,
      })
    }

    // Read the locally-stored session without any network call.
    // getSession() is safe to call at any time (offline, throttled tabs, etc.)
    // Token renewal is automatic via autoRefreshToken:true + the TOKEN_REFRESHED
    // listener below — no manual getUser() call is needed here.
    const checkSession = async () => {
      console.log("[auth] checkSession: reading session from localStorage")
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return

        if (session?.user) {
          console.log("[auth] checkSession: found session for user", session.user.id)
          await loadProfile(session.user.id, session.user.email || "")
          if (isMounted) {
            setIsLoading(false)
            setInitialAuthChecked(true)
            setAuthVersion((v) => v + 1)
            console.log("[auth] checkSession: done with session — initialAuthChecked=true, isLoading=false")
          }
        } else {
          console.log("[auth] checkSession: no session found — user not logged in")
          if (isMounted) {
            setIsLoading(false)
            setInitialAuthChecked(true)
            console.log("[auth] checkSession: done without session — initialAuthChecked=true, isLoading=false")
          }
        }
      } catch {
        // Transient error (network down, offline, etc.).
        // Do NOT clear auth storage — the localStorage session is still valid.
        // Supabase will auto-refresh the token when connectivity is restored
        // and fire TOKEN_REFRESHED, which the listener below handles.
        console.warn("[auth] checkSession: caught error (transient — NOT clearing session)")
        // Do NOT call setIsLoading(false) here — let onAuthStateChange handle it
        // when Supabase restores the session.
      }
    }

    checkSession()

    // Listen to auth state changes.
    // TOKEN_REFRESHED MUST be handled — when the user returns to a tab,
    // Supabase refreshes the token. If we ignore this event, the user
    // state stays stale/null and data-fetching pages gate on `!user`,
    // causing an infinite loading spinner.
    //
    // SIGNED_OUT is debounced by 1 second because Supabase can emit
    // SIGNED_OUT immediately followed by SIGNED_IN during a token refresh
    // cycle. Without the debounce, the instant SIGNED_OUT would clear the
    // user state and trigger a redirect before the follow-up SIGNED_IN arrives.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session: Session | null) => {
      if (!isMounted) return
      console.log("[auth] onAuthStateChange:", event, "user:", session?.user?.id ?? "none")

      // Cancel any pending sign-out when a sign-in/refresh arrives.
      // Also stamp the last-valid-auth time so the SIGNED_OUT debounce
      // can detect the SIGNED_IN → SIGNED_OUT ordering (tab focus pattern).
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        lastValidAuthRef.current = Date.now()
        if (signedOutTimerRef.current) {
          console.log("[auth] onAuthStateChange: cancelling pending SIGNED_OUT (token refresh cycle)")
          clearTimeout(signedOutTimerRef.current)
          signedOutTimerRef.current = null
        }
      }

      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        try {
          await loadProfile(session.user.id, session.user.email || "")
        } catch (error: any) {
          console.error("[auth] onAuthStateChange: loadProfile failed", error)
          if (!isMounted) return
        } finally {
          // Guarantee loading ends even if loadProfile fails.
          // authVersion increment signals pages that the token is now valid
          // and it's safe to fire Supabase queries without racing a refresh.
          if (isMounted) {
            setIsLoading(false)
            setInitialAuthChecked(true)
            setAuthVersion((v) => v + 1)
          }
        }
      } else if (event === "SIGNED_OUT") {
        // Debounce: wait 2 seconds before acting on SIGNED_OUT.
        // @supabase/ssr on tab focus fires events in this order when the
        // access token has expired and needs recovery:
        //   SIGNED_IN  (session recovered from refresh token)
        //   SIGNED_OUT (old invalidated session cleaned up)
        // The existing timer-cancel above handles SIGNED_OUT → SIGNED_IN.
        // The lastValidAuthRef guard below handles SIGNED_IN → SIGNED_OUT:
        // if we confirmed a valid session within the last 5 seconds, the
        // SIGNED_OUT is spurious and we skip clearing the user.
        console.log("[auth] onAuthStateChange: SIGNED_OUT received — debouncing for 2s before clearing user")
        if (signedOutTimerRef.current) clearTimeout(signedOutTimerRef.current)
        signedOutTimerRef.current = setTimeout(() => {
          if (!isMounted) return
          // Guard: if a valid SIGNED_IN/TOKEN_REFRESHED occurred within the
          // last 5 seconds, this SIGNED_OUT is part of a refresh cycle — ignore it.
          if (Date.now() - lastValidAuthRef.current < 5000) {
            console.log("[auth] onAuthStateChange: SIGNED_OUT suppressed — valid auth confirmed within last 5s")
            signedOutTimerRef.current = null
            return
          }
          console.log("[auth] onAuthStateChange: SIGNED_OUT confirmed after debounce — clearing user")
          signedOutTimerRef.current = null
          setUser(null)
          setIsLoading(false)
          setInitialAuthChecked(true)
        }, 2000)
      }
    })

    return () => {
      isMounted = false
      if (signedOutTimerRef.current) clearTimeout(signedOutTimerRef.current)
      subscription.unsubscribe()
    }
  }, []) // Empty dependency array since supabase is now stable via ref

  const login = async (email: string, password: string): Promise<"success" | "pending" | "failed"> => {
    if (!supabase || supabaseError) {
      throw new Error("Database connection is not configured. Please contact the administrator.")
    }

    try {
      // Add timeout to prevent hanging
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Login timed out. Please try again.")), 20000)
      )

      let result: any
      try {
        result = await Promise.race([loginPromise, timeoutPromise])
      } catch (networkError: any) {
        // Handle network failures (Failed to fetch, etc.)
        if (networkError?.message?.includes("Failed to fetch") || networkError?.name === "TypeError") {
          throw new Error("Network error. Please check your connection and try again.")
        }
        throw networkError
      }

      const { data, error } = result

      if (error) {
        if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
          throw new Error(
            "Please confirm your email address. Check your inbox (and spam folder) for a confirmation email from Homesta Cars. If you've already been approved by an administrator, you must confirm your email before logging in.",
          )
        }

        throw new Error(error.message)
      }

      if (data.user) {
        type ProfileRow = {
          id: string
          email: string | null
          full_name: string | null
          role: string
          avatar_url: string | null
          status: string | null
        }
        const { data: profile, error: profileError } = await (
          supabase.from("profiles").select("*").eq("id", data.user.id).single() as unknown as Promise<{
            data: ProfileRow | null
            error: any
          }>
        )

        if (profileError || !profile) {
          return "pending"
        }

        if (profile.status !== "active") {
          return "pending"
        }

        let investorId: string | undefined = undefined

        // If user is an investor, fetch their investor record
        if (profile.role === "investor") {
          const { data: investorData } = await (
            supabase.from("investors").select("id").eq("profile_id", profile.id).single() as unknown as Promise<{
              data: { id: string } | null
              error: any
            }>
          )

          if (investorData) {
            investorId = investorData.id
          }
        }

        setUser({
          id: profile.id,
          email: profile.email || data.user.email || "",
          name: profile.full_name || "",
          role: profile.role as "admin" | "staff" | "investor" | "customer",
          investorId,
          avatar_url: profile.avatar_url,
        })
        return "success"
      }
      return "failed"
    } catch (error: any) {
      throw error
    }
  }

  const logout = async () => {
    if (!supabase) return
    console.log("[auth] logout: signing out")
    await supabase.auth.signOut()
    setUser(null)
  }

  if (supabaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-red-200">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-red-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Database Not Configured</h2>
            <p className="text-gray-600 mb-4">
              The Supabase database connection is not set up. Please configure your environment variables to continue.
            </p>
            <div className="text-left bg-gray-50 p-4 rounded border border-gray-200">
              <p className="text-sm text-gray-700 font-mono mb-2">Required environment variables:</p>
              <ul className="text-xs text-gray-600 font-mono space-y-1">
                <li>• NEXT_PUBLIC_SUPABASE_URL</li>
                <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ user, isLoading, initialAuthChecked, authVersion, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
