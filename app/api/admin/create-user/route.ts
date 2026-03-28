import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * API Route: Create User (Staff/Admin/Investor/Customer)
 *
 * Uses Supabase Admin API to create auth users and corresponding profile records.
 * This endpoint requires the SUPABASE_SERVICE_ROLE_KEY environment variable.
 *
 * Customers can also be created later from booking flow; ensure idempotent logic on profile creation.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      full_name,
      phone,
      role,
      status = "active",
      nationality,
      birth_date,
      identity_number,
      address,
      position,
      company_name,
      total_investment,
      notes,
      send_invite = false,
    } = body

    // Validate required fields
    if (!email || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields: email, full_name, role" }, { status: 400 })
    }

    if (!send_invite && !password) {
      return NextResponse.json({ error: "Password required when not sending invite" }, { status: 400 })
    }

    // Create Supabase Admin client
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create auth user
    let authUser
    if (send_invite) {
      // Send invite email (user sets their own password)
      const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
      if (inviteError) throw new Error(`Auth invite error: ${inviteError.message}`)
      authUser = data.user
    } else {
      // Create user with provided password
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError) throw new Error(`Auth create error: ${createError.message}`)
      authUser = data.user
    }

    if (!authUser) {
      throw new Error("Failed to create auth user")
    }

    // Insert into profiles table
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.id,
      email,
      full_name,
      phone: phone || null,
      role,
      status,
      nationality: nationality || null,
      birth_date: birth_date || null,
      identity_number: identity_number || null,
      address: address || null,
    })

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(`Profile creation error: ${profileError.message}`)
    }

    // Insert into role-specific table
    if (role === "admin" || role === "staff") {
      const { error: teamError } = await supabaseAdmin.from("team_members").insert({
        profile_id: authUser.id,
        position: position || null,
        is_active: true,
      })
      if (teamError) throw new Error(`Team member creation error: ${teamError.message}`)
    } else if (role === "investor") {
      const { error: investorError } = await supabaseAdmin.from("investors").insert({
        profile_id: authUser.id,
        company_name: company_name || null,
        total_investment: total_investment || null,
        is_active: true,
      })
      if (investorError) throw new Error(`Investor creation error: ${investorError.message}`)
    } else if (role === "customer") {
      const { error: customerError } = await supabaseAdmin.from("customers").insert({
        profile_id: authUser.id,
        notes: notes || null,
      })
      if (customerError) throw new Error(`Customer creation error: ${customerError.message}`)
    }

    return NextResponse.json(
      {
        success: true,
        message: send_invite ? "User invite sent successfully" : "User created successfully",
        user_id: authUser.id,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[v0] Create user error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to create user" }, { status: 500 })
  }
}
