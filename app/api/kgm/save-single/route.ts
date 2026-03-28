import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/lib/supabase-server"

type KGMEntry = {
  car_id: string
  plate_number: string
  date: string
  toll_amount: number
  note: string | null
}

export async function POST(request: Request) {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: "Server configuration error: Missing Supabase credentials"
      }, { status: 500 })
    }

    // Get current user from session
    const serverClient = await getSupabaseServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    const currentUserId = user?.id || null

    const body = await request.json()
    const { entry } = body as { entry: KGMEntry }

    if (!entry || !entry.date || !entry.car_id) {
      return NextResponse.json({ error: "Entry with date and car_id is required" }, { status: 400 })
    }

    // Use service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete existing entry for this car on this date (upsert pattern)
    const { error: deleteError } = await supabaseAdmin
      .from("kgm")
      .delete()
      .eq("date", entry.date)
      .eq("car_id", entry.car_id)

    if (deleteError) {
      return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 })
    }

    // Only insert if there's data to save
    const hasData = (entry.toll_amount !== undefined && entry.toll_amount !== 0) || 
                    (entry.note !== null && entry.note.trim() !== "")

    if (hasData) {
      const insertData = {
        car_id: entry.car_id,
        plate_number: entry.plate_number,
        date: entry.date,
        toll_amount: entry.toll_amount || 0,
        note: entry.note || null,
        created_by: currentUserId,
      }

      const { error: insertError } = await supabaseAdmin
        .from("kgm")
        .insert(insertData)

      if (insertError) {
        return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Entry saved successfully",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save entry" }, { status: 500 })
  }
}
