// Database types for Homesta Cars

export type UserRole = "admin" | "manager" | "staff"
export type UserStatus = "pending" | "active"
export type SystemUserRole = "ADMIN" | "STAFF" | "INVESTOR"

export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "staff" | "investor" | "customer"
  investorId?: string // For investor users, links to investors.id
  avatar_url?: string | null // Profile avatar image URL
  created_at?: string
}

export type CarOwner = "Homesta" | "Alfahd Group"
export type CarTransmission = "Automatic" | "Manual"

export type CarStatus = "available" | "booked" | "maintenance" | "out-of-service"
export type CarCategory = "economy" | "comfort" | "premium" | "suv" | "luxury"

export interface Car {
  id: string
  model_group_id: number | null
  model_group?: {
    id: number
    name: string
    brand: string
    model: string
    image_url?: string
  } | null
  // These are derived from model_group for convenience
  brand?: string
  model?: string
  model_group_name?: string
  model_group_image?: string
  year: number
  plate_number: string
  investor_id?: number
  status: "PARKING" | "WORKING" | "SERVICE" | "SELLING" | "OUT_OF_SERVICE"
  transmission: "AUTOMATIC" | "MANUAL"
  fuel?: "BENZIN" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG"
  thumbnail_url?: string
  created_at: string
}

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled"
export type PaymentStatus = "pending" | "partial" | "paid" | "refunded"

export interface Booking {
  id: string
  car_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  pickup_date: string
  return_date: string
  pickupLocation: string
  dropoffLocation: string
  total_days: number
  daily_rate: number
  total_amount: number
  deposit_amount: number
  payment_status: PaymentStatus
  booking_status: BookingStatus
  notes?: string
  created_at: string
  updated_at: string
}

export type MaintenanceType = "routine" | "repair" | "inspection" | "cleaning"
export type MaintenanceStatus = "scheduled" | "in-progress" | "completed" | "cancelled"

export interface Maintenance {
  id: string
  car_id: string
  type: MaintenanceType
  description: string
  scheduled_date: string
  completed_date?: string
  cost: number
  status: MaintenanceStatus
  technician?: string
  notes?: string
  created_at: string
}

export interface DashboardStats {
  total_fleet: number
  available_cars: number
  active_bookings: number
  maintenance_due: number
  revenue_today: number
  revenue_month: number
  occupancy_rate: number
  upcoming_returns: number
}

export interface CarPricingAvailability {
  id: string
  car_id: string
  daily_price: number
  insurance_type?: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  updated_at: string
}

export interface Operation {
  id: string
  car_id: string
  operation_date: string
  mileage: number
  operation_type: string
  description?: string
  cost?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface OperationPhoto {
  id: string
  operation_id: string
  car_id: string
  photo_url: string
  category: "EXTERIOR" | "INTERIOR" | "DAMAGE" | "OTHER"
  created_at: string
}

export interface ModelGroup {
  id: string
  brand: string
  model: string
  thumbnail_url: string | null
  cars_count: number
}

// Extended types with joined data
export interface BookingWithCar extends Booking {
  car: Car
}

export interface MaintenanceWithCar extends Maintenance {
  car: Car
}

export interface TeamMemberWithProfile {
  id: string
  user_id: string
  full_name: string
  role: SystemUserRole
  is_active: boolean
  created_at: string
  profile: {
    email: string | null
    phone: string | null
    status: UserStatus
  }
}

export interface InvestorUser {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  status: UserStatus
  investor_id: number
  investor_name: string
  created_at: string
}

export interface CreateUserInput {
  role: SystemUserRole
  full_name: string
  email: string
  phone?: string
  password: string
  status: UserStatus
}

export interface CreateInvestorAccountInput {
  investor_id: number
  full_name: string
  email: string
  phone?: string
  password: string
  status: UserStatus
}

export interface CreateInvestorCompanyInput {
  name: string
  phone?: string
  email?: string
  notes?: string
}
