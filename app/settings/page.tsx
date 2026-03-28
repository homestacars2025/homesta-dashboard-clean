"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Settings, Upload, Camera, X, Save, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { uploadAndSaveAvatar, validateAvatarFile, deleteOldAvatar } from "@/lib/avatar-utils"
import { UserAvatar } from "@/components/user-avatar"

type ProfileData = {
  full_name: string
  phone: string
  nationality: string
  address: string
}

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Profile data
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    phone: "",
    nationality: "",
    address: "",
  })
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  // Read-only fields
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")

  // Password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  useEffect(() => {
    if (user && !authLoading) {
      loadProfile()
    }
  }, [user, authLoading])

  const loadProfile = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, nationality, address, email, role, status, avatar_url")
        .eq("id", user.id)
        .single()

      if (error) throw error

      if (data) {
        setProfileData({
          full_name: data.full_name || "",
          phone: data.phone || "",
          nationality: data.nationality || "",
          address: data.address || "",
        })
        setEmail(data.email || "")
        setRole(data.role)
        setStatus(data.status)
        setCurrentAvatarUrl(data.avatar_url)
      }
    } catch (error: any) {
      console.error("[v0] Failed to load profile:", error)
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    setAvatarFile(file)
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

  const handleUploadAvatar = async () => {
    if (!avatarFile || !user) return

    setIsUploadingAvatar(true)
    try {
      // Delete old avatar if exists
      if (currentAvatarUrl) {
        await deleteOldAvatar(currentAvatarUrl)
      }

      const result = await uploadAndSaveAvatar(avatarFile, user.id)
      if (result.success && result.url) {
        setCurrentAvatarUrl(result.url)
        setAvatarPreview(null)
        setAvatarFile(null)
        toast({
          title: "Success",
          description: "Avatar updated successfully",
        })
      } else {
        throw new Error(result.error || "Failed to upload avatar")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    if (!profileData.full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name is required",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.full_name.trim(),
          phone: profileData.phone.trim() || null,
          nationality: profileData.nationality.trim() || null,
          address: profileData.address.trim() || null,
        })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "All password fields are required",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)
    try {
      const supabase = getSupabaseBrowserClient()

      // First verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        throw new Error("Current password is incorrect")
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) throw updateError

      // Clear password fields
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      toast({
        title: "Success",
        description: "Password changed successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account settings and preferences</p>
            </div>
          </div>

          {/* Profile Photo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Profile Photo
              </CardTitle>
              <CardDescription>Update your profile picture</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  {avatarPreview ? (
                    <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-gray-200">
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
                    <UserAvatar
                      src={currentAvatarUrl}
                      name={profileData.full_name}
                      size="xl"
                      className="h-24 w-24"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      className="bg-transparent"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Photo
                    </Button>
                    {avatarFile && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleUploadAvatar}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? "Uploading..." : "Save Photo"}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG or WebP. Max 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Read-only fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Email (cannot be changed)</Label>
                  <p className="font-medium">{email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <p className="font-medium capitalize">{role}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="font-medium capitalize">{status}</p>
                </div>
              </div>

              <Separator />

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={profileData.nationality}
                    onChange={(e) => setProfileData({ ...profileData, nationality: e.target.value })}
                    placeholder="Enter your nationality"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder="Enter your address"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={isChangingPassword} variant="outline" className="bg-transparent">
                  <Lock className="h-4 w-4 mr-2" />
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
