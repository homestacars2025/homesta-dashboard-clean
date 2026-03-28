import { getSupabaseBrowserClient } from "./supabase-client"
import type {
  CreateUserInput,
  CreateInvestorAccountInput,
  CreateInvestorCompanyInput,
  TeamMemberWithProfile,
  InvestorUser,
} from "./types"
import type { Investor } from "./database.types"

export const userManagementService = {
  async listTeamUsers(): Promise<TeamMemberWithProfile[]> {
    const supabase = getSupabaseBrowserClient()

    // Fetch team members first
    const { data: teamMembers, error: teamError } = await supabase
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: false })

    if (teamError) {
      console.error("[v0] Error fetching team members:", teamError)
      throw new Error("Failed to fetch team members")
    }

    if (!teamMembers || teamMembers.length === 0) {
      return []
    }

    // Fetch profiles separately
    const userIds = teamMembers.map((tm) => tm.user_id)
    const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").in("id", userIds)

    if (profileError) {
      console.error("[v0] Error fetching profiles:", profileError)
      // Continue without profiles
    }

    // Join in code
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

    return teamMembers
      .filter((tm) => tm.role === "ADMIN" || tm.role === "STAFF")
      .map((tm) => {
        const profile = profileMap.get(tm.user_id)
        return {
          id: tm.id,
          user_id: tm.user_id,
          full_name: tm.full_name,
          role: tm.role,
          is_active: tm.is_active,
          created_at: tm.created_at,
          profile: {
            email: profile?.email || null,
            phone: profile?.phone || null,
            status: profile?.status || "pending",
          },
        }
      })
  },

  // List all investor companies
  async listInvestors(): Promise<Investor[]> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase.from("investors").select("*").order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching investors:", error)
      throw new Error("Failed to fetch investors")
    }

    return data || []
  },

  async listInvestorUsers(): Promise<InvestorUser[]> {
    const supabase = getSupabaseBrowserClient()

    // Fetch profiles with investor_id
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .not("investor_id", "is", null)
      .order("created_at", { ascending: false })

    if (profileError) {
      console.error("[v0] Error fetching investor profiles:", profileError)
      throw new Error("Failed to fetch investor users")
    }

    if (!profiles || profiles.length === 0) {
      return []
    }

    // Fetch investors separately
    const investorIds = profiles.map((p) => p.investor_id).filter((id): id is number => id !== null)
    const { data: investors, error: investorError } = await supabase.from("investors").select("*").in("id", investorIds)

    if (investorError) {
      console.error("[v0] Error fetching investors:", investorError)
      // Continue without investor names
    }

    // Join in code
    const investorMap = new Map(investors?.map((inv) => [inv.id, inv]) || [])

    return profiles.map((profile) => {
      const investor = investorMap.get(profile.investor_id!)
      return {
        id: profile.id,
        full_name: profile.full_name || "Unknown",
        email: profile.email || "",
        phone: profile.phone || null,
        status: profile.status,
        investor_id: profile.investor_id!,
        investor_name: investor?.name || "Unknown",
        created_at: profile.created_at,
      }
    })
  },

  // Toggle team member active status
  async toggleTeamMemberActive(teamMemberId: string, isActive: boolean): Promise<void> {
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.from("team_members").update({ is_active: isActive }).eq("id", teamMemberId)

    if (error) {
      console.error("[v0] Error toggling team member active status:", error)
      throw new Error("Failed to update team member status")
    }
  },

  // Update profile status
  async updateProfileStatus(userId: string, status: "pending" | "active"): Promise<void> {
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId)

    if (error) {
      console.error("[v0] Error updating profile status:", error)
      throw new Error("Failed to update profile status")
    }
  },

  // Create investor company
  async createInvestorCompany(input: CreateInvestorCompanyInput): Promise<Investor> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase
      .from("investors")
      .insert({
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating investor company:", error)
      throw new Error("Failed to create investor company")
    }

    return data
  },

  // Create STAFF or ADMIN user
  async createStaffOrAdminUser(input: CreateUserInput): Promise<{ success: boolean; message: string }> {
    try {
      // Call admin API to create auth user
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          full_name: input.full_name,
          phone: input.phone,
          role: input.role,
          status: input.status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user")
      }

      return { success: true, message: "User created successfully" }
    } catch (error: any) {
      console.error("[v0] Error creating staff/admin user:", error)
      return { success: false, message: error.message || "Failed to create user" }
    }
  },

  // Create INVESTOR account
  async createInvestorAccount(input: CreateInvestorAccountInput): Promise<{ success: boolean; message: string }> {
    try {
      // Call admin API to create auth user for investor
      const response = await fetch("/api/admin/create-investor-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_id: input.investor_id,
          email: input.email,
          password: input.password,
          full_name: input.full_name,
          phone: input.phone,
          status: input.status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create investor account")
      }

      return { success: true, message: "Investor account created successfully" }
    } catch (error: any) {
      console.error("[v0] Error creating investor account:", error)
      return { success: false, message: error.message || "Failed to create investor account" }
    }
  },
}
