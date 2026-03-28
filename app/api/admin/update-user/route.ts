import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * API Route: Update User
 * Updates auth credentials (email/password) and profile data
 * SECURE: Verifies requester is admin via Authorization header token
 */

export async function PUT(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 })
    }
    const accessToken = authHeader.substring(7) // Remove "Bearer " prefix

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Verify user identity using admin client with the provided token
    // This is more reliable than creating a new client with the token in headers
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    
    if (authError || !requester) {
      console.error("[v0] Auth verification failed:", authError?.message || "No user found for token")
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    // Check requester's role from profiles using admin client (bypasses RLS)
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }

    if (!requesterProfile || requesterProfile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can update users" }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, email, password, updates } = body

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
    }

    // Update auth credentials if provided (email and/or password)
    const authUpdates: { email?: string; password?: string } = {}
    if (email && email.trim()) {
      authUpdates.email = email.trim()
    }
    if (password && password.trim()) {
      authUpdates.password = password.trim()
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdates)
      if (authError) {
        throw new Error(`Auth update error: ${authError.message}`)
      }
    }

    // Update profiles table if profile updates provided
    if (updates?.profile && Object.keys(updates.profile).length > 0) {
      // If email was updated, also update it in profiles
      const profileUpdates = { ...updates.profile }
      if (authUpdates.email) {
        profileUpdates.email = authUpdates.email
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user_id)

      if (profileError) {
        throw new Error(`Profile update error: ${profileError.message}`)
      }
    }

    // Update role-specific table if provided
    if (updates?.team_member) {
      await supabaseAdmin.from("team_members").update(updates.team_member).eq("profile_id", user_id)
    }
    if (updates?.investor) {
      await supabaseAdmin.from("investors").update(updates.investor).eq("profile_id", user_id)
    }
    if (updates?.customer) {
      await supabaseAdmin.from("customers").update(updates.customer).eq("profile_id", user_id)
    }

    return NextResponse.json({ success: true, message: "User updated successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Update user error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
