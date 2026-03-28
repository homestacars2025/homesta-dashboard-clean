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
    // Validate environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: "Server configuration error: Missing Supabase credentials",
        details: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!serviceRoleKey
        }
      }, { status: 500 })
    }

    // Get current user from session
    const serverClient = await getSupabaseServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    const currentUserId = user?.id || null

    const body = await request.json()
    const { entries, date } = body as { entries: KGMEntry[]; date: string }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: "Entries array is required" }, { status: 400 })
    }

    // Use service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete existing entries for this date
    const { error: deleteError } = await supabaseAdmin
      .from("kgm")
      .delete()
      .eq("date", date)

    if (deleteError) {
      return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 })
    }

    // Insert new entries with created_by set to current user ID
    if (entries.length > 0) {
      // Filter out any entries with undefined toll_amount and clean payload
      const cleanEntries = entries
        .filter(entry => entry.toll_amount !== undefined)
        .map(entry => ({
          car_id: entry.car_id,
          plate_number: entry.plate_number,
          date: entry.date,
          toll_amount: entry.toll_amount,
          note: entry.note || null,
          created_by: currentUserId,
        }))

      if (cleanEntries.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("kgm")
          .insert(cleanEntries)

        if (insertError) {
          return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${entries.length} entries saved successfully`,
      count: entries.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save entries" }, { status: 500 })
  }
}
