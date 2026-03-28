import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * API Route: Delete User
 * Deletes auth user (cascades to profiles and role tables)
 */

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get("user_id")

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete auth user (cascades to profiles and role tables via ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (error) {
      throw new Error(`Delete user error: ${error.message}`)
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("[v0] Delete user error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
