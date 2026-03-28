export type Database = {
  public: {
    Enums: {
      user_status: "pending" | "active" | "inactive" | "blocked"
      user_role: "admin" | "staff" | "investor" | "customer"
    }
    Tables: {
      cars: {
        Row: {
          id: number
          created_at: string
          brand: string
          model: string
          model_group: string
          year: number
          plate_number: string
          status: "WORKING" | "PARKING" | "SELLING" | "SERVICE" | "OUT_OF_SERVICE"
          investor_id: string | null
          lien_amount: number | null
          lien_type: "none" | "amount" | "agri_hasar" | null
          inspection_due_date: string | null
          insurance_expiry_date: string | null
          insurance_policy_url: string | null
          ruhsat_url: string | null
          current_km: number | null
          next_oil_change_km: number | null
          purchase_contract_url: string | null
          registration_file_url: string | null
          thumbnail_url: string | null
          brand_id: string | null
          model_id: string | null
          fuel: "BENZIN" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG" | null
          transmission: "AUTOMATIC" | "MANUAL" | null
        }
        Insert: {
          id?: number
          created_at?: string
          brand: string
          model: string
          model_group: string
          year: number
          plate_number: string
          status?: "WORKING" | "PARKING" | "SELLING" | "SERVICE" | "OUT_OF_SERVICE"
          investor_id?: string | null
          lien_amount?: number | null
          lien_type?: "none" | "amount" | "agri_hasar" | null
          inspection_due_date?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_url?: string | null
          ruhsat_url?: string | null
          current_km?: number | null
          next_oil_change_km?: number | null
          purchase_contract_url?: string | null
          registration_file_url?: string | null
          thumbnail_url?: string | null
          brand_id?: string | null
          model_id?: string | null
          fuel?: "BENZIN" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG" | null
          transmission?: "AUTOMATIC" | "MANUAL" | null
        }
        Update: {
          id?: number
          created_at?: string
          brand?: string
          model?: string
          model_group?: string
          year?: number
          plate_number?: string
          status?: "WORKING" | "PARKING" | "SELLING" | "SERVICE" | "OUT_OF_SERVICE"
          investor_id?: string | null
          lien_amount?: number | null
          lien_type?: "none" | "amount" | "agri_hasar" | null
          inspection_due_date?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_url?: string | null
          ruhsat_url?: string | null
          current_km?: number | null
          next_oil_change_km?: number | null
          purchase_contract_url?: string | null
          registration_file_url?: string | null
          thumbnail_url?: string | null
          brand_id?: string | null
          model_id?: string | null
          fuel?: "BENZIN" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG" | null
          transmission?: "AUTOMATIC" | "MANUAL" | null
        }
      }
      car_brands: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
      }
      car_models: {
        Row: {
          id: string
          brand_id: string
          name: string
          thumbnail_url: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          thumbnail_url?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          name?: string
          thumbnail_url?: string | null
        }
      }
      investors: {
        Row: {
          id: string
          created_at: string
          profile_id: string
          company_name: string | null
          total_investment: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          profile_id: string
          company_name?: string | null
          total_investment?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          profile_id?: string
          company_name?: string | null
          total_investment?: number | null
          is_active?: boolean
        }
      }
      bookings: {
        Row: {
          id: number
          created_at: string
          car_id: number
          customer_id: string
          booking_type: "STANDARD" | "LONG_TERM" | "CORPORATE"
          status: "pending" | "confirmed" | "completed" | "cancelled"
          start_date: string
          end_date: string
          insurance_type: "TRAFFIC" | "FULL_KASKO"
          booking_number: string
          pickupLocation: string
          dropoff_location: string
          fuelLevel: string | null
          additional_driver_id: string | null
          notes: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          car_id: number
          customer_id: string
          booking_type?: "STANDARD" | "LONG_TERM" | "CORPORATE"
          status?: "pending" | "confirmed" | "completed" | "cancelled"
          start_date: string
          end_date: string
          insurance_type?: "TRAFFIC" | "FULL_KASKO" | null
          booking_number?: string
          pickupLocation?: string | null
          dropoff_location?: string | null
          fuelLevel?: string | null
          additional_driver_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          car_id?: number
          customer_id?: string
          booking_type?: "STANDARD" | "LONG_TERM" | "CORPORATE"
          status?: "pending" | "confirmed" | "completed" | "cancelled"
          start_date?: string
          end_date?: string
          insurance_type?: "TRAFFIC" | "FULL_KASKO" | null
          booking_number?: string
          pickupLocation?: string | null
          dropoff_location?: string | null
          fuelLevel?: string | null
          additional_driver_id?: string | null
          notes?: string | null
        }
      }
      operations: {
        Row: {
          id: number
          created_at: string
          type: "RECEIVING" | "DELIVERY" | "RETURN" | "CAR_WASH" | "SERVICE" | "OIL_CHANGE" | "HANDOVER" | "MAINTENANCE"
          car_id: number
          customer_id: number | null
          booking_id: number | null
          location_text: string | null
          mileage: number | null
          operation_date: string
          operation_time: string
          current_km: number | null
          note: string | null
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          type: "RECEIVING" | "DELIVERY" | "RETURN" | "CAR_WASH" | "SERVICE" | "OIL_CHANGE" | "HANDOVER" | "MAINTENANCE"
          car_id: number
          customer_id?: number | null
          booking_id?: number | null
          location_text?: string | null
          mileage?: number | null
          operation_date?: string
          operation_time?: string
          current_km?: number | null
          note?: string | null
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          type?:
            | "RECEIVING"
            | "DELIVERY"
            | "RETURN"
            | "CAR_WASH"
            | "SERVICE"
            | "OIL_CHANGE"
            | "HANDOVER"
            | "MAINTENANCE"
          car_id?: number
          customer_id?: number | null
          booking_id?: number | null
          location_text?: string | null
          mileage?: number | null
          operation_date?: string
          operation_time?: string
          current_km?: number | null
          note?: string | null
          created_by?: string | null
          deleted_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string // Changed from number to string (UUID)
          created_at: string
          first_name: string
          last_name: string
          phone: string
          identity_number: string
          nationality: string | null
          id_type: string | null
          driving_license_number: string | null
          address: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          first_name: string
          last_name: string
          phone: string
          identity_number: string
          nationality?: string | null
          id_type?: string | null
          driving_license_number?: string | null
          address?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          first_name?: string
          last_name?: string
          phone?: string
          identity_number?: string
          nationality?: string | null
          id_type?: string | null
          driving_license_number?: string | null
          address?: string | null
          notes?: string | null
        }
      }
      car_pricing_availability: {
        Row: {
          id: string
          created_at: string
          car_id: string
          date: string
          is_available: boolean
          daily_price: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          car_id: string
          date: string
          is_available?: boolean
          daily_price?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          car_id?: string
          date?: string
          is_available?: boolean
          daily_price?: number | null
        }
      }
      operation_photos: {
        Row: {
          id: string
          created_at: string
          operation_id: number
          file_url: string
          storage_path: string
          category: "general" | "damage" | "interior" | "exterior" | "documents"
        }
        Insert: {
          id?: string
          created_at?: string
          operation_id: number
          file_url: string
          storage_path: string
          category?: "general" | "damage" | "interior" | "exterior" | "documents"
        }
        Update: {
          id?: string
          created_at?: string
          operation_id?: number
          file_url?: string
          storage_path?: string
          category?: "general" | "damage" | "interior" | "exterior" | "documents"
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          full_name: string | null
          email: string | null
          phone: string | null
          nationality: string | null
          birth_date: string | null
          identity_number: string | null
          address: string | null
          role: "admin" | "staff" | "investor" | "customer"
          status: "pending" | "active" | "inactive" | "blocked"
        }
        Insert: {
          id: string
          created_at?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          nationality?: string | null
          birth_date?: string | null
          identity_number?: string | null
          address?: string | null
          role: "admin" | "staff" | "investor" | "customer"
          status?: "pending" | "active" | "inactive" | "blocked"
        }
        Update: {
          id?: string
          created_at?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          nationality?: string | null
          birth_date?: string | null
          identity_number?: string | null
          address?: string | null
          role?: "admin" | "staff" | "investor" | "customer"
          status?: "pending" | "active" | "inactive" | "blocked"
        }
      }
      team_members: {
        Row: {
          id: string
          created_at: string
          profile_id: string
          position: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          profile_id: string
          position?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          profile_id?: string
          position?: string | null
          is_active?: boolean
        }
      }
      locations: {
        Row: {
          id: number
          name: string
          code: string
        }
        Insert: {
          id?: number
          name: string
          code: string
        }
        Update: {
          id?: number
          name?: string
          code?: string
        }
      }
      blocks: {
        Row: {
          id: number
          created_at: string
          car_id: number
          start_date: string
          end_date: string
          block_type: "SERVICE" | "SELLING" | "OUT_OF_SERVICE" | "HOLD"
          notes: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          car_id: number
          start_date: string
          end_date: string
          block_type: "SERVICE" | "SELLING" | "OUT_OF_SERVICE" | "HOLD"
          notes?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          car_id?: number
          start_date?: string
          end_date?: string
          block_type?: "SERVICE" | "SELLING" | "OUT_OF_SERVICE" | "HOLD"
          notes?: string | null
        }
      }
      partners: {
        Row: {
          id: string
          created_at: string
          profile_id: string
          company_name: string | null
          country: string | null
          api_access: boolean
          status: "active" | "suspended"
          api_key: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          profile_id: string
          company_name?: string | null
          country?: string | null
          api_access?: boolean
          status?: "active" | "suspended"
          api_key?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          profile_id?: string
          company_name?: string | null
          country?: string | null
          api_access?: boolean
          status?: "active" | "suspended"
          api_key?: string | null
        }
      }
      car_images: {
        Row: {
          id: string
          created_at: string
          car_id: number
          image_url: string
          is_primary: boolean
          display_order: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          car_id: number
          image_url: string
          is_primary?: boolean
          display_order?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          car_id?: number
          image_url?: string
          is_primary?: boolean
          display_order?: number | null
        }
      }
      car_photos: {
        Row: {
          id: number
          created_at: string
          car_id: number
          file_path: string
          is_primary: boolean
          sort_order: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          car_id: number
          file_path: string
          is_primary?: boolean
          sort_order?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          car_id?: number
          file_path?: string
          is_primary?: boolean
          sort_order?: number | null
        }
      }
      financial_transactions: {
        Row: {
          id: number
          created_at: string
          investor_id: string
          month_key: string
          sheet_type: "car" | "buy_sell" | "company_expenses" | "personal_expenses"
          transaction_type: "income" | "expense"
          category: string
          amount: number
          direction: "in" | "out"
          car_id: number | null
          explanation: string | null
          date: string
          linked_to: number | null // Added linked_to field for commission linking
        }
        Insert: {
          id?: number
          created_at?: string
          investor_id: string
          month_key: string
          sheet_type: "car" | "buy_sell" | "company_expenses" | "personal_expenses"
          transaction_type: "income" | "expense"
          category: string
          amount: number
          direction: "in" | "out"
          car_id?: number | null
          explanation?: string | null
          date?: string
          linked_to?: number | null // Added linked_to field for commission linking
        }
        Update: {
          id?: number
          created_at?: string
          investor_id?: string
          month_key?: string
          sheet_type?: "car" | "buy_sell" | "company_expenses" | "personal_expenses"
          transaction_type?: "income" | "expense"
          category?: string
          amount?: number
          direction?: "in" | "out"
          car_id?: number | null
          explanation?: string | null
          date?: string
          linked_to?: number | null // Added linked_to field for commission linking
        }
      }
    }
  }
}

export type CarBrand = Database["public"]["Tables"]["car_brands"]["Row"]
export type CarModel = Database["public"]["Tables"]["car_models"]["Row"]
export type Investor = Database["public"]["Tables"]["investors"]["Row"]
export type Location = Database["public"]["Tables"]["locations"]["Row"]
export type Customer = Database["public"]["Tables"]["customers"]["Row"]
export type Block = Database["public"]["Tables"]["blocks"]["Row"]
// CalendarBlock type removed - table does not exist
export type CalendarBlock = {
  id: number
  car_id: number
  start_date: string
  end_date: string
  block_type: string
}
export type Partner = Database["public"]["Tables"]["partners"]["Row"]

export type Operation = Database["public"]["Tables"]["operations"]["Row"]
export type OperationPhoto = Database["public"]["Tables"]["operation_photos"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"]

export type CarPlateDropdown = {
  car_id: number
  plate_number: string
  label: string
}

export type UserDirectoryRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: "admin" | "staff" | "investor" | "customer"
  status: "pending" | "active" | "inactive" | "blocked"
  created_at: string
  nationality: string | null
  birth_date: string | null
  identity_number: string | null
  address: string | null
  team_member_id: string | null
  position: string | null
  team_is_active: boolean | null
  investor_id: string | null
  company_name: string | null
  total_investment: number | null
  investor_is_active: boolean | null
  customer_id: string | null
  notes: string | null
}

export type CarImage = Database["public"]["Tables"]["car_images"]["Row"]
export type CarPhoto = Database["public"]["Tables"]["car_photos"]["Row"]

export type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"]

export type CustomerWithProfile = Customer & {
  profile?: {
    full_name: string | null
    phone: string | null
    identity_number: string | null
    nationality: string | null
    address: string | null
  }
}
