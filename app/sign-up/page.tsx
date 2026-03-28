"use client"

import type React from "react"

import { useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Info, UserPlus, Upload, X, Camera } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { uploadAvatar, validateAvatarFile } from "@/lib/avatar-utils"

export default function SignUpPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    phone: "",
    nationality: "",
    birth_date: "",
    identity_number: "",
    address: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      setError(validation.error || "Invalid file")
      return
    }

    setAvatarFile(file)
    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (avatarInputRef.current) {
      avatarInputRef.current.value = ""
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (
      !formData.email ||
      !formData.password ||
      !formData.full_name ||
      !formData.phone ||
      !formData.nationality ||
      !formData.birth_date
    ) {
      setError("Email, password, full name, phone, nationality, and birth date are required")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)

    try {
      // STEP 1: Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
          // Email confirmation cannot be disabled from frontend
          // This setting is managed in Supabase Dashboard > Authentication > Email Auth
        },
      })

      if (signUpError) {
        setError(signUpError.message || "Failed to create account")
        return
      }

      if (!authData.user) {
        setError("Failed to create user account")
        return
      }

      // STEP 2: Upload avatar if provided
      let avatarUrl: string | null = null
      if (avatarFile) {
        const uploadResult = await uploadAvatar(avatarFile, authData.user.id)
        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url
        }
        // Don't fail signup if avatar upload fails - it's optional
      }

      // STEP 3: Insert into profiles with all required fields
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
        nationality: formData.nationality,
        birth_date: formData.birth_date,
        identity_number: formData.identity_number || null,
        address: formData.address || null,
        role: "customer",
        status: "pending",
        avatar_url: avatarUrl,
      })

      if (profileError) {
        console.error("[v0] Profile creation error:", profileError)
        setError("Account created but profile setup failed. Please contact support.")
        return
      }

      router.push("/pending-approval")
    } catch (err: any) {
      console.error("[v0] Sign up error:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>Create your Homesta Cars account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              After sign-up, you'll receive a confirmation email. Click the link in the email to verify your account.
              Then, an administrator will need to activate your account before you can log in.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Avatar Upload (Optional) */}
            <div className="space-y-2">
              <Label>Profile Photo (Optional)</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarPreview ? (
                    <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={avatarPreview || "/placeholder.svg"}
                        alt="Avatar preview"
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => avatarInputRef.current?.click()}
                      className="h-20 w-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Camera className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isLoading}
                    className="bg-transparent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {avatarPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG or WebP. Max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="full_name"
                type="text"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+90 555 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">
                Nationality <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nationality"
                type="text"
                placeholder="Turkey"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">
                Birth Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="identity_number">Identity Number (Optional)</Label>
              <Input
                id="identity_number"
                type="text"
                placeholder="12345678901"
                value={formData.identity_number}
                onChange={(e) => setFormData({ ...formData, identity_number: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                type="text"
                placeholder="123 Main St, Istanbul"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="ml-1 text-blue-600 hover:underline">
            Log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
