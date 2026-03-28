"use client"

import { useEffect } from "react"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Car, Mail, RefreshCw } from "lucide-react"
import Link from "next/link"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()
  const { login, user, isLoading: authLoading } = useAuth()
  
  // If user is already logged in, redirect
  useEffect(() => {
    if (user && !authLoading && !redirecting) {
      setRedirecting(true)
      router.replace("/general")
    }
  }, [user, authLoading, redirecting, router])

  const handleResendConfirmation = async () => {
    if (!email) {
      setError("Please enter your email address first.")
      return
    }
    
    setResendingEmail(true)
    setResendSuccess(false)
    
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      })
      
      if (error) {
        setError(`Failed to resend: ${error.message}`)
      } else {
        setResendSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend confirmation email.")
    } finally {
      setResendingEmail(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(false)
    setNeedsEmailConfirmation(false)
    setResendSuccess(false)
    setIsLoading(true)

    // Safety timeout - never stay in loading state more than 10 seconds
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false)
      setError("Request timed out. Please try again.")
    }, 10000)

    try {
      const result = await login(email, password)
      clearTimeout(safetyTimeout)
      if (result === "pending") {
        setIsPending(true)
        setIsLoading(false)
      } else if (result === "success") {
        router.replace("/general")
      } else {
        setError("Invalid email or password. Please try again.")
        setIsLoading(false)
      }
    } catch (err: any) {
      clearTimeout(safetyTimeout)
      // Check if this is an email confirmation error
      if (err.message?.includes("confirm your email") || err.message?.includes("email_not_confirmed")) {
        setNeedsEmailConfirmation(true)
      } else {
        setError(err.message || "An error occurred. Please try again.")
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 rounded-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="p-3 rounded-xl" style={{ backgroundColor: "#5BC0F8" }}>
              <Car className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Homesta Cars</CardTitle>
          <CardDescription className="text-slate-500">Sign in to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="border-slate-200 focus:border-[#5BC0F8] focus:ring-[#5BC0F8]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="border-slate-200 focus:border-[#5BC0F8] focus:ring-[#5BC0F8]"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {needsEmailConfirmation && (
              <Alert className="bg-blue-50 border-blue-200">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong className="block mb-1">Email Confirmation Required</strong>
                  <span className="text-sm">
                    Please check your inbox (and spam folder) for a confirmation email from Homesta Cars. 
                    Click the link in that email to verify your account, then try logging in again.
                  </span>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendConfirmation}
                      disabled={resendingEmail}
                      className="bg-transparent border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {resendingEmail ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3 mr-1" />
                          Resend Confirmation Email
                        </>
                      )}
                    </Button>
                  </div>
                  {resendSuccess && (
                    <p className="mt-2 text-sm text-green-700 font-medium">
                      Confirmation email sent! Please check your inbox.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isPending && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-900">
                  <strong>Account Pending Approval</strong>
                  <br />
                  Your account has been created but is pending administrator approval. An admin must complete your
                  profile and assign your role before you can access the dashboard.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full text-white font-medium shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: "#5BC0F8" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#4AB0E8" }}
              onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#5BC0F8" }}
              disabled={isLoading || redirecting}
            >
              {redirecting ? "Redirecting..." : isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-sm text-center text-slate-500">
              Need access?{" "}
              <Link href="/sign-up" className="font-medium hover:underline" style={{ color: "#5BC0F8" }}>
                Sign Up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
