"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Shield, UsersIcon, Upload, X, Camera } from "lucide-react"
import { format } from "date-fns"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { UserAvatar } from "@/components/user-avatar"
import { uploadAndSaveAvatar, validateAvatarFile, deleteOldAvatar } from "@/lib/avatar-utils"
import { PhoneInput } from "@/components/ui/phone-input"
import { CountrySelect } from "@/components/ui/country-select"

type UserProfile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  nationality: string | null
  birth_date: string | null
  identity_number: string | null
  address: string | null
  role: "admin" | "staff" | "investor" | "customer"
  status: "pending" | "active" | "inactive" | "blocked"
  avatar_url: string | null
  created_at: string
}

export default function UsersManagementPage() {
  const { user, initialAuthChecked } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    email: "",
    new_password: "",
    phone: "",
    nationality: "",
    birth_date: "",
    identity_number: "",
    address: "",
    role: "customer" as "admin" | "staff" | "investor" | "customer",
    status: "pending" as "pending" | "active" | "inactive" | "blocked",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Avatar management state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const isFetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    if (initialAuthChecked && user) {
      loadUsers()
    } else if (initialAuthChecked && !user) {
      setIsLoading(false)
    }
  }, [initialAuthChecked, user])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (!initialAuthChecked || !user) return
    loadUsers()
  }, isFetchingRef)

  const loadUsers = async () => {
    try {
      isFetchingRef.current = true
      if (!hasLoadedOnceRef.current) setIsLoading(true)
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, phone, nationality, birth_date, identity_number, address, role, status, avatar_url, created_at",
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      setUsers(data || [])
      hasLoadedOnceRef.current = true
    } catch (error) {
      console.error("[v0] Failed to load users:", error)
      if (!hasLoadedOnceRef.current) {
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }

  const handleEditUser = (userToEdit: UserProfile) => {
    setSelectedUser(userToEdit)
    setEditFormData({
      full_name: userToEdit.full_name || "",
      email: userToEdit.email || "",
      new_password: "",
      phone: userToEdit.phone || "",
      nationality: userToEdit.nationality || "",
      birth_date: userToEdit.birth_date || "",
      identity_number: userToEdit.identity_number || "",
      address: userToEdit.address || "",
      role: userToEdit.role,
      status: userToEdit.status,
    })
    // Reset avatar state
    setAvatarFile(null)
    setAvatarPreview(userToEdit.avatar_url)
    setShowEditModal(true)
  }

  const generatePassword = () => {
    const password = Math.random().toString(36).slice(-10)
    setEditFormData({ ...editFormData, new_password: password })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error || "Invalid file",
        variant: "destructive",
      })
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

  const removeAvatar = async () => {
    if (!selectedUser) return
    
    setIsUploadingAvatar(true)
    try {
      // Delete from storage if there's an existing avatar
      if (selectedUser.avatar_url) {
        await deleteOldAvatar(selectedUser.avatar_url)
      }
      
      // Update profile to remove avatar_url
      const supabase = getSupabaseBrowserClient()
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", selectedUser.id)
      
      setAvatarFile(null)
      setAvatarPreview(null)
      
      toast({
        title: "Avatar Removed",
        description: "Profile photo has been removed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove avatar",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveUser = async () => {
    if (!selectedUser) return

    if (!editFormData.full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name is required",
        variant: "destructive",
      })
      return
    }

    if (!editFormData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      
      // Get access token for API auth - use getSession first, then validate with getUser
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshData.session?.access_token) {
          throw new Error("No active session - please log in again")
        }
      }
      
      // Get fresh session after potential refresh
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession?.access_token) {
        throw new Error("Session expired - please log in again")
      }
      
      const accessToken = currentSession.access_token

      // Upload new avatar if provided
      let avatarUrl = selectedUser.avatar_url
      if (avatarFile) {
        const uploadResult = await uploadAndSaveAvatar(avatarFile, selectedUser.id)
        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url
        }
      }
      
      // Call backend API to update user (handles auth email/password securely)
      const response = await fetch("/api/admin/update-user", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          email: editFormData.email.trim() !== selectedUser.email ? editFormData.email.trim() : undefined,
          password: editFormData.new_password || undefined,
          updates: {
            profile: {
              full_name: editFormData.full_name.trim(),
              email: editFormData.email.trim(), // Always include email in profile
              phone: editFormData.phone || null,
              nationality: editFormData.nationality || null,
              birth_date: editFormData.birth_date || null,
              identity_number: editFormData.identity_number.trim() || null,
              address: editFormData.address.trim() || null,
              role: editFormData.role,
              status: editFormData.status,
              avatar_url: avatarUrl,
            },
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update user")
      }

      // Sync role to appropriate tables (inline instead of RPC)
      try {
        // Remove from all role-specific tables first
        await supabase.from("team_members").delete().eq("profile_id", selectedUser.id)
        await supabase.from("investors").delete().eq("profile_id", selectedUser.id)

        // Add to appropriate table based on role
        if (editFormData.role === "admin" || editFormData.role === "staff") {
          await supabase.from("team_members").upsert({
            profile_id: selectedUser.id,
            position: null,
            is_active: true,
          }, { onConflict: "profile_id" })
        } else if (editFormData.role === "investor") {
          await supabase.from("investors").upsert({
            profile_id: selectedUser.id,
            company_name: null,
            total_investment: null,
            is_active: true,
          }, { onConflict: "profile_id" })
        }
      } catch (syncError) {
        // Don't fail the whole operation if role sync fails
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      })

      await loadUsers()
      setShowEditModal(false)
      setSelectedUser(null)
    } catch (error: any) {
      console.error("Failed to save user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (user?.role !== "admin") {
    return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <Alert className="max-w-md">
              <Shield className="h-4 w-4" />
              <AlertDescription>Access denied. Only administrators can access this page.</AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (isLoading) {
    return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "staff"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground mt-2">Manage user profiles and access</p>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <UsersIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No users found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              src={u.avatar_url}
                              name={u.full_name || u.email || "User"}
                              size="sm"
                            />
                            <span className="font-medium">{u.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{u.email || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              u.role === "admin"
                                ? "border-red-300 bg-red-50 text-red-700"
                                : u.role === "staff"
                                  ? "border-blue-300 bg-blue-50 text-blue-700"
                                  : u.role === "investor"
                                    ? "border-green-300 bg-green-50 text-green-700"
                                    : "border-gray-300 bg-gray-50 text-gray-700"
                            }
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              u.status === "active"
                                ? "bg-green-100 text-green-700"
                                : u.status === "pending"
                                  ? "bg-orange-100 text-orange-700"
                                  : u.status === "blocked"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                            }
                          >
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(u.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleEditUser(u)}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user profile information, role, and status.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Avatar Upload Section */}
                <div className="space-y-2">
                  <Label>Profile Photo</Label>
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
                            disabled={isUploadingAvatar}
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
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
                        disabled={isSubmitting || isUploadingAvatar}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isSubmitting || isUploadingAvatar}
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
                  <Label>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={editFormData.new_password}
                      onChange={(e) => setEditFormData({ ...editFormData, new_password: e.target.value })}
                      placeholder="Leave empty to keep current"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                      className="shrink-0"
                    >
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Only fill this if you want to change the password</p>
                </div>
                <div className="space-y-2">
                  <Label>
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <PhoneInput
                    value={editFormData.phone}
                    onChange={(value) => setEditFormData({ ...editFormData, phone: value })}
                    placeholder="Enter phone number"
                    defaultCountry="TR"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={editFormData.role}
                      onValueChange={(value: any) => setEditFormData({ ...editFormData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="investor">Investor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value: any) => setEditFormData({ ...editFormData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <CountrySelect
                    value={editFormData.nationality}
                    onChange={(value) => setEditFormData({ ...editFormData, nationality: value })}
                    placeholder="Select nationality"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Birth Date</Label>
                  <Input
                    type="date"
                    value={editFormData.birth_date}
                    onChange={(e) => setEditFormData({ ...editFormData, birth_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Identity Number</Label>
                  <Input
                    value={editFormData.identity_number}
                    onChange={(e) => setEditFormData({ ...editFormData, identity_number: e.target.value })}
                    placeholder="Enter identity number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSaveUser} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
