import { format } from "date-fns"
import type { BookingWithCustomer, Block, Car } from "./types"

export type VehicleStatus = "PARKING" | "WORKING" | "SERVICE" | "SELLING"

export type CellStatusType = "parking" | "working" | "service" | "selling"

/**
 * SINGLE SOURCE OF TRUTH FOR VEHICLE STATUS
 * 
 * This function computes a vehicle's status for a specific date based on
 * the Availability Calendar logic. The calendar is the ONLY source of truth.
 * 
 * Calendar Color Mapping:
 * - GREEN → available (parking) - car is available for booking
 * - RED → booked (working) - confirmed booking exists
 * - YELLOW → selling - car is listed for sale
 * - GRAY → service - car is under maintenance
 * 
 * Logic Priority:
 * 1. If a confirmed booking overlaps the date → WORKING (RED)
 * 2. If car.status = 'service' → SERVICE (GRAY)
 * 3. If car.status = 'selling' → SELLING (YELLOW)
 * 4. Otherwise → PARKING (GREEN) - available
 */
export function getVehicleStatusForDate(
  carId: number,
  date: Date,
  bookings: BookingWithCustomer[],
  blocks: Block[],
  car?: { status?: string }
): VehicleStatus {
  const dateStr = format(date, "yyyy-MM-dd")

  // Priority 1: Check for CONFIRMED booking (Working = RED = booked)
  // Only confirmed bookings are considered - no pending status
  const confirmedBooking = bookings.find(
    (b) => Number(b.car_id) === Number(carId) && 
           dateStr >= b.start_date && dateStr <= b.end_date
  )
  if (confirmedBooking) {
    return "WORKING" // RED = confirmed booking
  }

  // Priority 2: Check for blocks (selling/service)
  const block = blocks.find((b) => Number(b.car_id) === Number(carId) && dateStr >= b.start_date && dateStr <= b.end_date)
  if (block) {
    if (block.block_type === "SERVICE") {
      return "SERVICE" // GRAY
    }
    if (block.block_type === "SELLING") {
      return "SELLING" // YELLOW
    }
  }

  // Priority 3: Fall back to car.status from database (lowercase)
  if (car?.status) {
    const carStatus = car.status.toLowerCase()
    if (carStatus === "service") return "SERVICE"
    if (carStatus === "selling") return "SELLING"
    if (carStatus === "working") return "WORKING"
  }

  // Default: Available/Parking (GREEN)
  return "PARKING"
}

/**
 * Compute TODAY's status for a vehicle
 * This is the primary function used across the app
 */
export function getVehicleTodayStatus(
  carId: number,
  bookings: BookingWithCustomer[],
  blocks: Block[],
  car?: { status?: string }
): VehicleStatus {
  return getVehicleStatusForDate(carId, new Date(), bookings, blocks, car)
}

/**
 * Get API availability response
 * For external integrations - simple available/unavailable mapping
 * 
 * Mapping:
 * - parking → available
 * - working → unavailable
 * - service → unavailable
 * - selling → unavailable
 */
export function getApiAvailability(status: VehicleStatus): "available" | "unavailable" {
  return status === "PARKING" ? "available" : "unavailable"
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: VehicleStatus): string {
  switch (status) {
    case "PARKING":
      return "Parking"
    case "WORKING":
      return "Working"
    case "SERVICE":
      return "Service"
    case "SELLING":
      return "Selling"
    default:
      return status.toLowerCase().replace("_", " ")
  }
}

/**
 * Get unified status colors (Tailwind classes)
 * UNIFIED COLOR SYSTEM:
 * - PARKING = GREEN (available)
 * - WORKING = RED (booked)
 * - SERVICE = GRAY
 * - SELLING = YELLOW
 */
export function getStatusColorClasses(status: VehicleStatus): string {
  switch (status) {
    case "PARKING":
      return "bg-green-100 text-green-700 border-green-200" // GREEN - available
    case "WORKING":
      return "bg-red-100 text-red-700 border-red-200" // RED - booked
    case "SERVICE":
      return "bg-gray-100 text-gray-700 border-gray-200" // GRAY
    case "SELLING":
      return "bg-yellow-100 text-yellow-700 border-yellow-200" // YELLOW
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}
