import { getSupabaseBrowserClient } from "./supabase-client"
import { safeSupabaseCall } from "./utils"
import type {
  Car,
  Booking,
  Maintenance,
  DashboardStats,
  BookingWithCar,
  MaintenanceWithCar,
  User,
  CarPricingAvailability,
  Operation,
  OperationPhoto,
  ModelGroup,
  Customer,
} from "./types"

export const dataService = {
  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const supabase = getSupabaseBrowserClient()

    const [carsResult, bookingsResult, operationsResult] = await Promise.all([
      supabase.from("cars").select("id"),
      supabase.from("bookings").select("status, start_date, end_date"),
      supabase.from("operations").select("status"),
    ])

    const totalCars = carsResult.data?.length || 0
    const availableCars = 0 // status is not on cars table; use car_availability view for status
    const activeBookings = bookingsResult.data?.filter((b) => b.status === "confirmed" || b.status === "pending").length || 0
    const pendingMaintenance = operationsResult.data?.filter((o) => o.status === "pending").length || 0
    const monthlyRevenue = 0 // total_price not in bookings; calculate from customer_accounting_ledger if needed
    
    // Calculate occupancy rate
    const occupancyRate = totalCars > 0 ? Math.round((activeBookings / totalCars) * 100) : 0
    
    // Calculate upcoming returns (bookings ending in next 7 days)
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcomingReturns = bookingsResult.data?.filter((b) => {
      const endDate = new Date(b.end_date)
      return endDate >= today && endDate <= nextWeek
    }).length || 0

    return {
      total_fleet: totalCars,
      available_cars: availableCars,
      active_bookings: activeBookings,
      maintenance_due: pendingMaintenance,
      revenue_today: 0, // Would need daily revenue calculation
      revenue_month: monthlyRevenue,
      occupancy_rate: occupancyRate,
      upcoming_returns: upcomingReturns,
    }
  },

  // Cars
  async getCars(): Promise<Car[]> {
    const supabase = getSupabaseBrowserClient()

    const { data: carsData, error: carsError } = await supabase
      .from("cars")
      .select("*, model_group:model_group(id, name, brand, model, image_url)")
      .order("created_at", { ascending: false })

    if (carsError) {
      return []
    }

    if (!carsData || carsData.length === 0) {
      return []
    }

    // Map cars with brand and model from model_group
    return carsData.map((car: any) => ({
      ...car,
      brand: car.model_group?.brand || "Unknown",
      model: car.model_group?.model || "Unknown",
      model_group_name: car.model_group?.name || null,
      model_group_image: car.model_group?.image_url || null,
    }))
  },

  async getCar(id: string): Promise<Car | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("cars").select("*").eq("id", id).single()

    if (error) return null
    return data
  },

  async updateCarStatus(_id: string, _status: Car["status"]): Promise<Car | null> {
    // cars table has no status column — status lives in car_availability view
    return null
  },

  async createCar(carData: Omit<Car, "id" | "created_at">): Promise<Car> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("cars").insert([carData]).select("*").single()

    if (error) throw error
    return data
  },

  async updateCar(id: string, carData: Partial<Car>): Promise<Car | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("cars").update(carData).eq("id", id).select("*").single()

    if (error) return null
    return data
  },

  async deleteCar(id: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("cars").delete().eq("id", id)

    return !error
  },

  // Get model groups summary
  async getModelGroups(): Promise<ModelGroup[]> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase
      .from("model_group")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      return []
    }

    return data || []
  },

  // Get cars by model group
  async getCarsByModelGroup(modelGroupId: number): Promise<Car[]> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase
      .from("cars")
      .select("*, model_group:model_group(id, name, brand, model)")
      .eq("model_group_id", modelGroupId)
      .order("created_at", { ascending: false })

    if (error) {
      return []
    }

    return (data || []).map((car: any) => ({
      ...car,
      brand: car.model_group?.brand || "Unknown",
      model: car.model_group?.model || "Unknown",
    }))
  },

  // Get car with full details
  async getCarDetails(carId: string): Promise<{
    car: Car
    pricing: CarPricingAvailability | null
    operations: Operation[]
    photos: OperationPhoto[]
  } | null> {
    const supabase = getSupabaseBrowserClient()

    const numericCarId = Number.parseInt(carId, 10)
    if (Number.isNaN(numericCarId)) {
      return null
    }

    const [carResult, pricingResult, operationsResult] = await Promise.all([
      supabase.from("cars").select("*").eq("id", numericCarId).single(),
      supabase.from("car_pricing_availability").select("*").eq("car_id", numericCarId).limit(1).single(),
      supabase.from("operations").select("*").eq("car_id", numericCarId).order("created_at", { ascending: false }),
    ])

    if (carResult.error || !carResult.data) {
      return null
    }

    // Get photos for operations
    const operationIds = operationsResult.data?.map((o) => o.id) || []
    const photosResult =
      operationIds.length > 0
        ? await supabase.from("operation_photos").select("*").in("operation_id", operationIds)
        : { data: [] }

    return {
      car: carResult.data,
      pricing: pricingResult.data || null,
      operations: operationsResult.data || [],
      photos: photosResult.data || [],
    }
  },

  // Get car status counts
  async getCarStatusCounts(): Promise<{
    total: number
    working: number
    parking: number
    selling: number
    service: number
  }> {
    const supabase = getSupabaseBrowserClient()
    // cars table has no status column — get total from cars, status from car_availability
    const { data: carsData } = await supabase.from("cars").select("id")
    const { data: availData } = await supabase.from("car_availability").select("id, status")

    const total = carsData?.length || 0
    const working = availData?.filter((c: any) => c.status?.toLowerCase() === "working").length || 0
    const parking = availData?.filter((c: any) => c.status?.toLowerCase() === "parking").length || 0
    const selling = availData?.filter((c: any) => c.status?.toLowerCase() === "selling").length || 0
    const service = availData?.filter((c: any) => c.status?.toLowerCase() === "service").length || 0

    return { total, working, parking, selling, service }
  },

  // Get latest operation for a car (for mileage)
  async getLatestOperation(carId: string): Promise<Operation | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .eq("car_id", carId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data
  },

  // Bookings
  async getBookings(): Promise<Booking[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false })

    if (error) return []
    return data || []
  },

  async getBookingsWithCars(): Promise<BookingWithCar[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        car:cars(id, plate_number, model_group:model_group_id(brand, model))
      `)
      .order("created_at", { ascending: false })

    if (error) return []
    return (data || []).map((booking: any) => ({
      ...booking,
      car: {
        ...booking.car,
        brand: booking.car?.model_group?.brand || "",
        model: booking.car?.model_group?.model || "",
      } as unknown as Car,
    })) as BookingWithCar[]
  },

  async getBooking(id: string): Promise<Booking | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single()

    if (error) return null
    return data
  },

  async updateBookingStatus(id: string, status: Booking["booking_status"]): Promise<Booking | null> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("bookings").update({ status }).eq("id", id).select("*").single()

    if (error) return null
    return data
  },

  async updatePaymentStatus(_id: string, _status: Booking["payment_status"]): Promise<Booking | null> {
    // bookings table has no payment_status column — payment tracking uses customer_accounting_ledger
    return null
  },

  async createBooking(bookingData: {
    car_id: number
    customer_id: string
    status: string
    start_date: string
    end_date: string
    insurance_type?: string | null
    pickup_location?: string | null
    dropoff_location?: string | null
    notes?: string | null
  }): Promise<Booking> {
    return safeSupabaseCall(async () => {
    const supabase = getSupabaseBrowserClient()

    try {
      // Build insert payload matching bookings table schema EXACTLY
      // block_type is NOT in bookings table - it's in car_calendar (handled by trigger)
      const payload = {
        car_id: bookingData.car_id,
        customer_id: bookingData.customer_id,
        start_date: bookingData.start_date,
        end_date: bookingData.end_date,
        status: bookingData.status || "pending",
        insurance_type: bookingData.insurance_type || null,
        pickup_location: bookingData.pickup_location || null,
        dropoff_location: bookingData.dropoff_location || null,
        notes: bookingData.notes || null,
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert([payload])
        .select()

      if (error) {
        throw new Error(`BOOKING_INSERT_FAILED: ${error.message} (code: ${error.code})`)
      }

      if (!data || data.length === 0) {
        throw new Error("Booking creation returned no data")
      }

      return data[0]
    } catch (err: any) {
      throw err
    }
    }, 15000)
  },

  async confirmBooking(bookingId: number): Promise<boolean> {
    return safeSupabaseCall(async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId)
      if (error) return false
      return true
    }, 10000)
  },

  async updateBooking(
    bookingId: number,
    bookingData: {
      car_id?: number
      customer_id?: string
      status?: string
      booking_type?: string
      start_date?: string
      end_date?: string
      insurance_type?: string
      pickup_location?: string | null
      dropoff_location?: string | null
      fuel_level?: string | null
      additional_driver_id?: string | null
      notes?: string | null
      rental_amount?: number
      paid_amount?: number
      deposit_amount?: number
      financial_note?: string
    },
  ): Promise<boolean> {
    return safeSupabaseCall(async () => {
    const supabase = getSupabaseBrowserClient()

    try {
      // Build update object with only valid booking table columns
      // Do NOT use spread operator to avoid including extra fields that cause schema errors
      const bookingTableData: Record<string, unknown> = {}
      
      if (bookingData.car_id !== undefined) bookingTableData.car_id = bookingData.car_id
      if (bookingData.customer_id !== undefined) bookingTableData.customer_id = bookingData.customer_id
      // booking_type does not exist in bookings table — omitted
      if (bookingData.start_date !== undefined) bookingTableData.start_date = bookingData.start_date
      if (bookingData.end_date !== undefined) bookingTableData.end_date = bookingData.end_date
      if (bookingData.insurance_type !== undefined) bookingTableData.insurance_type = bookingData.insurance_type
      if (bookingData.notes !== undefined) bookingTableData.notes = bookingData.notes
      if (bookingData.pickup_location !== undefined) bookingTableData.pickup_location = bookingData.pickup_location
      if (bookingData.dropoff_location !== undefined) bookingTableData.dropoff_location = bookingData.dropoff_location
      if (bookingData.status !== undefined) bookingTableData.status = bookingData.status

      // Extract financial fields for later processing
      const { rental_amount, paid_amount, deposit_amount, financial_note } = bookingData

      const { error } = await supabase.from("bookings").update(bookingTableData).eq("id", bookingId)

      if (error) {
        throw new Error(`Failed to update booking: ${error.message}`)
      }

      // Sync financial data to customer_accounting_ledger
      const hasFinancialData =
        (rental_amount !== undefined && rental_amount > 0) ||
        (paid_amount !== undefined && paid_amount > 0) ||
        (deposit_amount !== undefined && deposit_amount > 0)

      if (hasFinancialData) {
        // Fetch the existing booking to get customer_id and car_id
        // (these may not be in bookingData if the caller didn't change them)
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('customer_id, car_id')
          .eq('id', bookingId)
          .single()

        const customerId = bookingData.customer_id || existingBooking?.customer_id
        const carId = bookingData.car_id || existingBooking?.car_id

        if (customerId && carId) {
          // Delete existing ledger entries for this booking before re-inserting
          await supabase
            .from('customer_accounting_ledger')
            .delete()
            .eq('booking_id', bookingId)

          const ledgerEntries = []

          if (rental_amount !== undefined && rental_amount > 0) {
            ledgerEntries.push({
              booking_id: bookingId,
              customer_id: customerId,
              car_id: carId,
              type: 'rental',
              transaction_type: 'rental',
              direction: 'OUT',
              amount: rental_amount,
              description: financial_note ? `Rental charge - ${financial_note}` : 'Rental charge',
            })
          }

          if (paid_amount !== undefined && paid_amount > 0) {
            ledgerEntries.push({
              booking_id: bookingId,
              customer_id: customerId,
              car_id: carId,
              type: 'payment',
              transaction_type: 'payment',
              direction: 'IN',
              amount: paid_amount,
              description: financial_note ? `Payment received - ${financial_note}` : 'Payment received',
            })
          }

          if (deposit_amount !== undefined && deposit_amount > 0) {
            ledgerEntries.push({
              booking_id: bookingId,
              customer_id: customerId,
              car_id: carId,
              type: 'deposit',
              transaction_type: 'deposit',
              direction: 'IN',
              amount: deposit_amount,
              description: financial_note ? `Deposit - ${financial_note}` : 'Deposit',
            })
          }

          // Ensure correct types before insert
          const typedEntries = ledgerEntries.map(e => ({
            ...e,
            booking_id: Number(e.booking_id),
            car_id: Number(e.car_id),
            amount: Number(e.amount),
          }))

          if (typedEntries.length > 0) {
            const { error: ledgerError } = await supabase
              .from('customer_accounting_ledger')
              .insert(typedEntries)

            if (ledgerError) {
              throw new Error(`Failed to sync financial data: ${ledgerError.message}`)
            }
          }
        }
      }

      return true
    } catch (err: any) {
      throw err
    }
    }, 15000) // 15s timeout for update (includes update + ledger sync)
  },

  async deleteBooking(bookingId: number): Promise<boolean> {
    const supabase = getSupabaseBrowserClient()

    try {
      const { error } = await supabase.from("bookings").delete().eq("id", bookingId)

      if (error) {
        return false
      }

      return true
    } catch (err: any) {
      return false
    }
  },

  // Maintenance
  async getMaintenance(): Promise<Maintenance[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("operations").select("*").order("created_at", { ascending: false })

    if (error) return []
    return data || []
  },

  async getMaintenanceWithCars(): Promise<MaintenanceWithCar[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("operations")
      .select(`
        *,
        car:cars(id, plate_number, model_group:model_group_id(brand, model))
      `)
      .order("created_at", { ascending: false })

    if (error) return []
    return (data || []).map((operation: any) => ({
      ...operation,
      car: {
        ...operation.car,
        brand: operation.car?.model_group?.brand || "",
        model: operation.car?.model_group?.model || "",
      } as unknown as Car,
    })) as MaintenanceWithCar[]
  },

  async updateMaintenanceStatus(id: string, status: Maintenance["status"]): Promise<Maintenance | null> {
    const supabase = getSupabaseBrowserClient()
    const updateData: any = { status }
    if (status === "completed") {
      updateData.completed_date = new Date().toISOString()
    }

    const { data, error } = await supabase.from("operations").update(updateData).eq("id", id).select("*").single()

    if (error) return null
    return data
  },

  // Auth
  async login(email: string, password: string): Promise<User | null> {
    // Mock login - in production this would use Supabase Auth
    // For now, just return a mock user if credentials are provided
    if (email && password) {
      return {
        id: "u1",
        name: "Admin User",
        email: email,
        role: "admin" as const,
      }
    }
    return null
  },

  async getCurrentUser(): Promise<User | null> {
    // Mock - in production this would check Supabase session
    return {
      id: "u1",
      name: "Admin User",
      email: "admin@homesta.com",
      role: "admin" as const,
    }
  },

  async getInvestors(): Promise<{ id: number; name: string; phone: string | null; email: string | null }[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("investors")
      .select("id, name, phone, email")
      .order("name", { ascending: true })

    if (error) {
      return []
    }
    return data || []
  },

  async getCarStatusBreakdown(): Promise<{ status: string; count: number }[]> {
    const supabase = getSupabaseBrowserClient()
    // cars table has no status column — read status from car_availability view
    const { data, error } = await supabase.from("car_availability").select("status")

    if (error) {
      return []
    }

    // Count cars by status
    const statusMap: Record<string, number> = {}
    data?.forEach((row: any) => {
      const status = row.status || "UNKNOWN"
      statusMap[status] = (statusMap[status] || 0) + 1
    })

    // Convert to array format
    return Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
    }))
  },

  async getCarsByOwner(): Promise<{ owner_name: string; count: number }[]> {
    const supabase = getSupabaseBrowserClient()

    const [carsResult, investorsResult, profilesResult] = await Promise.all([
      supabase.from("cars").select("investor_id"),
      supabase.from("investors").select("id, profile_id"),
      supabase.from("profiles").select("id, full_name"),
    ])

    if (carsResult.error) {
      return []
    }

    if (investorsResult.error) {
      return []
    }

    if (profilesResult.error) {
      return []
    }

    // Create a map of profile ID to name
    const profileMap: Record<string, string> = {}
    profilesResult.data?.forEach((profile: any) => {
      profileMap[profile.id] = profile.full_name || "Unknown"
    })

    // Create a map of investor ID to profile name
    const investorMap: Record<string, string> = {}
    investorsResult.data?.forEach((investor: any) => {
      investorMap[investor.id] = profileMap[investor.profile_id] || "Unknown"
    })

    // Count cars by investor
    const ownerMap: Record<string, number> = {}
    carsResult.data?.forEach((car: any) => {
      const ownerName = car.investor_id ? investorMap[car.investor_id] || "Unassigned" : "Unassigned"
      ownerMap[ownerName] = (ownerMap[ownerName] || 0) + 1
    })

    // Convert to array format
    return Object.entries(ownerMap)
      .map(([owner_name, count]) => ({
        owner_name,
        count,
      }))
      .sort((a, b) => a.owner_name.localeCompare(b.owner_name))
  },

  async getLocations(): Promise<{ id: number; name: string; code: string }[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("locations").select("id, name, code").order("name", { ascending: true })

    if (error) {
      return []
    }
    return data || []
  },

  // Customers
  async createCustomer(customerData: {
    first_name: string
    last_name: string
    phone: string
    id_number: string
    nationality?: string | null
    birth_date?: string | null
    id_type?: string | null
    driving_license_number?: string | null
    address?: string | null
    notes?: string | null
  }): Promise<string> {
    return safeSupabaseCall(async () => {
    const supabase = getSupabaseBrowserClient()

    try {
      const { data: customerRecord, error: customerError } = await supabase
        .from("customers")
        .insert({
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          phone: customerData.phone,
          id_number: customerData.id_number,
          nationality: customerData.nationality || null,
          birth_date: customerData.birth_date || null,
          id_type: customerData.id_type || null,
          driving_license_number: customerData.driving_license_number || null,
          address: customerData.address || null,
          notes: customerData.notes || null,
        })
        .select("id")
        .single()

      if (customerError) {
        throw new Error(`Failed to create customer: ${customerError.message}`)
      }

      if (!customerRecord || !customerRecord.id) {
        throw new Error("Customer creation returned no ID")
      }

      const customerId = customerRecord.id

      if (typeof customerId !== "string" || customerId.length === 0) {
        throw new Error(`Invalid customer ID returned: ${customerId}`)
      }

      return customerId
    } catch (err: any) {
      throw err
    }
    }, 10000)
  },

  async findCustomerByIdNumber(idNumber: string): Promise<Customer | null> {
    return safeSupabaseCall(async () => {
    const supabase = getSupabaseBrowserClient()

    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id_number", idNumber)
        .maybeSingle()

      if (!customerError && customerData) {
        return {
          id: customerData.id,
          id_number: customerData.id_number,
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          phone: customerData.phone,
          nationality: customerData.nationality,
          id_type: customerData.id_type,
          driving_license_number: customerData.driving_license_number,
          address: customerData.address,
          notes: customerData.notes,
        }
      }

      if (customerError?.message?.includes("does not exist")) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            phone,
            id_number,
            nationality,
            address,
            customers!inner(id, notes)
          `)
          .eq("id_number", idNumber)
          .eq("role", "customer")
          .maybeSingle()

        if (profileError || !profileData || !profileData.customers) {
          return null
        }

        const customer = Array.isArray(profileData.customers) ? profileData.customers[0] : profileData.customers
        const nameParts = (profileData.full_name || "").split(" ")
        const firstName = nameParts[0] || ""
        const lastName = nameParts.slice(1).join(" ") || ""

        return {
          id: customer.id,
          id_number: profileData.id_number,
          first_name: firstName,
          last_name: lastName,
          phone: profileData.phone,
          nationality: profileData.nationality,
          id_type: null,
          driving_license_number: null,
          address: profileData.address,
          notes: customer.notes,
        }
      }

      return null
    } catch (error: any) {
      return null
    }
    }, 10000)
  },

  async updateCustomer(
    customerId: string, // Change from number to string (UUID)
    customerData: {
      first_name?: string
      last_name?: string
      phone?: string
      id_number?: string
      nationality?: string | null
      birth_date?: string | null
      id_type?: string | null
      driving_license_number?: string | null
      address?: string | null
      notes?: string | null
    },
  ): Promise<boolean> {
    return safeSupabaseCall(async () => {
    const supabase = getSupabaseBrowserClient()

    try {
      const { error } = await supabase.from("customers").update(customerData).eq("id", customerId)

      if (error) {
        throw new Error(`Failed to update customer: ${error.message}`)
      }

      return true
    } catch (err: any) {
      throw err
    }
    }, 10000)
  },

  // Availability Calendar - calendar_blocks table removed, using bookings table instead
  async getBlocks(): Promise<any[]> {
    // calendar_blocks table does not exist - return empty array
    return []
  },

  async createBlock(blockData: {
    car_id: number
    start_date: string
    end_date: string
    block_type: "SERVICE" | "SELLING"
    notes?: string | null
  }): Promise<any> {
    // calendar_blocks table does not exist - throw error
    throw new Error("Manual blocks are not supported. Use bookings instead.")
  },

  async updateBlock(
    blockId: number,
    blockData: Partial<{
      start_date: string
      end_date: string
      block_type: "SERVICE" | "SELLING"
      notes: string | null
    }>,
  ): Promise<any> {
    // calendar_blocks table does not exist - throw error
    throw new Error("Manual blocks are not supported. Use bookings instead.")
  },

  async deleteBlock(blockId: number, carId?: number): Promise<boolean> {
    // calendar_blocks table does not exist - return false
    return false
  },

  async getBookingsForAvailability(startDate: string, endDate: string): Promise<any[]> {
    const supabase = getSupabaseBrowserClient()

    // Only fetch CONFIRMED bookings - no pending or other statuses
    // Date overlap condition: booking overlaps with range if
    // start_date <= endDate AND end_date >= startDate
    const [bookingsResult, carsResult, customersResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .eq("status", "confirmed")
        .lte("start_date", endDate)
        .gte("end_date", startDate)
        .order("start_date", { ascending: true }),
      supabase.from("cars").select("id, plate_number, model_group:model_group_id(brand, model)"),
      supabase.from("customers").select("id, first_name, last_name"),
    ])

    if (bookingsResult.error) {
      return []
    }

    // Create lookup maps for cars and customers
    const carsMap: Record<number, any> = {}
    carsResult.data?.forEach((car: any) => {
      carsMap[car.id] = {
        ...car,
        brand: car.model_group?.brand || "",
        model: car.model_group?.model || "",
      }
    })

    // Note: customer_id may be UUID (string), so use string keys
    const customersMap: Record<string, any> = {}
    customersResult.data?.forEach((customer: any) => {
      customersMap[customer.id] = customer
    })

    // Join data in JavaScript
    return (bookingsResult.data || []).map((booking: any) => ({
      ...booking,
      car: carsMap[booking.car_id] || null,
      customer: customersMap[booking.customer_id] || null,
    }))
  },

  async getBlocksForDateRange(startDate: string, endDate: string): Promise<any[]> {
    // calendar_blocks table does not exist - return empty array
    return []
  },

  async getCustomers(): Promise<Customer[]> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true })

    if (error) {
      return []
    }

    return data || []
  },
  
  async getOperations(month?: { year: number; month: number }): Promise<any[]> {
    const supabase = getSupabaseBrowserClient()

    let query = supabase
      .from("operations")
      .select("*, customers(id, first_name, last_name)")
      .is("deleted_at", null)
      .order("operation_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (month) {
      const startDate = `${month.year}-${String(month.month).padStart(2, "0")}-01`
      const daysInMonth = new Date(month.year, month.month, 0).getDate()
      const endDate = `${month.year}-${String(month.month).padStart(2, "0")}-${daysInMonth}`
      query = query.gte("operation_date", startDate).lte("operation_date", endDate)
    }

    const { data, error } = await query

    if (error) {
      return []
    }

    // Fetch car details and performer profile separately for each operation
    if (data && data.length > 0) {
      const operationsWithDetails = await Promise.all(
        data.map(async (op) => {
          let car = null
          let performer = null

          if (op.car_id) {
            const { data: carData } = await supabase
              .from("cars")
              .select("id, plate_number, model_group:model_group_id(brand, model)")
              .eq("id", op.car_id)
              .single()
            if (carData) {
              const cd = carData as any
              car = { ...cd, brand: cd.model_group?.brand || "", model: cd.model_group?.model || "" }
            }
          }

          if (op.performed_by) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .eq("id", op.performed_by)
              .single()
            performer = profileData
          }

          return { ...(op as any), car, performer }
        })
      )
      return operationsWithDetails
    }

    return data || []
  },

  async getCarPlateDropdown(): Promise<Array<{ car_id: number; plate_number: string; label: string }>> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.from("cars").select("id, plate_number, model_group(name, brand, model)").order("plate_number")

    if (error) {
      return []
    }

    return (
      data?.map((car: any) => ({
        car_id: car.id,
        plate_number: car.plate_number,
        label: `${car.plate_number} - ${car.model_group?.brand || ""} ${car.model_group?.model || ""}`.trim(),
      })) || []
    )
  },

  // Operations
  mapOperationTypeToDb(uiType: string): string {
    if (!uiType) {
      return "MAINTENANCE"
    }

    const mapping: Record<string, string> = {
      receiving: "RECEIVING",
      delivery: "DELIVERY",
      return: "RETURN",
      car_wash: "CAR_WASH",
      service: "SERVICE",
      oil_change: "OIL_CHANGE",
      handover: "HANDOVER",
      maintenance: "MAINTENANCE",
    }

    // If already uppercase, return as is
    if (Object.values(mapping).includes(uiType.toUpperCase())) {
      return uiType.toUpperCase()
    }

    // Otherwise map from lowercase
    const dbType = mapping[uiType.toLowerCase()]
  if (!dbType) {
    return "MAINTENANCE"
    }
    return dbType
  },

  async createOperation(operation: {
    car_id: number
    customer_id: number | null
    performed_by: string
    operation_type: string
    operation_date: string
    current_kilometer: number
    cleanliness_status?: string | null
    note?: string | null
  }): Promise<any> {
    const supabase = getSupabaseBrowserClient()

    const { data, error } = await supabase
      .from("operations")
      .insert({
        car_id: operation.car_id,
        customer_id: operation.customer_id,
        performed_by: operation.performed_by,
        type: operation.operation_type,
        operation_date: operation.operation_date,
        current_km: operation.current_kilometer,
        cleanliness_status: operation.cleanliness_status || null,
        note: operation.note || null,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    // Fetch car details separately
    if (data && data.car_id) {
      const { data: carRaw } = await supabase
        .from("cars")
        .select("id, plate_number, model_group:model_group_id(brand, model)")
        .eq("id", data.car_id)
        .single()
      const carAny = carRaw as any
      const car = carAny ? { ...carAny, brand: carAny.model_group?.brand || "", model: carAny.model_group?.model || "" } : null
      return { ...(data as any), car }
    }

    return data
  },

  async uploadOperationPhotos(operationId: number, files: File[], category?: string): Promise<void> {
    const supabase = getSupabaseBrowserClient()
    
    for (const file of files) {
      try {
        // Generate unique filename with UUID
        const fileExtension = file.name.split('.').pop() || 'jpg'
        const uuid = crypto.randomUUID()
        const fileName = `${uuid}.${fileExtension}`
        const filePath = `operations/${operationId}/${fileName}`
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('opertion_photos')
          .upload(filePath, file)
        
        if (uploadError) {
          throw uploadError
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('opertion_photos')
          .getPublicUrl(filePath)
        
        // Insert record into operation_photos table
        const { error: dbError } = await supabase
          .from('operation_photos')
          .insert({
            operation_id: operationId,
            storage_path: filePath,
            file_url: urlData.publicUrl,
            category: category || 'general',
          })
        
        if (dbError) {
          throw dbError
        }
      } catch (error) {
        // Continue with other photos even if one fails
      }
    }
  },

  async softDeleteOperation(operationId: number): Promise<void> {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase
      .from("operations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", operationId)

    if (error) {
      throw error
    }
  },

  async restoreOperation(operationId: number): Promise<void> {
    const supabase = getSupabaseBrowserClient()

    const { error: rpcError } = await supabase.rpc("restore_operation", { p_id: operationId })

    if (rpcError) {
      // If RPC doesn't exist, use direct update as fallback
      if (rpcError.message.includes("Could not find the function")) {
        const { error: updateError } = await supabase
          .from("operations")
          .update({ deleted_at: null })
          .eq("id", operationId)

        if (updateError) {
          throw updateError
        }
        return
      }

      throw rpcError
    }
  },

  async hardDeleteOperation(operationId: number): Promise<void> {
    const supabase = getSupabaseBrowserClient()

    const { error: rpcError } = await supabase.rpc("hard_delete_operation", { p_id: operationId })

    if (rpcError) {
      // If RPC doesn't exist, use direct delete as fallback
      if (rpcError.message.includes("Could not find the function")) {
        // First delete photos
        const { error: photosError } = await supabase.from("operation_photos").delete().eq("operation_id", operationId)

        // Continue anyway, photos might not exist

        // Then delete the operation
        const { error: deleteError } = await supabase.from("operations").delete().eq("id", operationId)

        if (deleteError) {
          throw deleteError
        }
        return
      }

      throw rpcError
    }
  },

  async getOperationPhotos(operationId: number): Promise<any[]> {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("operation_photos")
      .select("*")
      .eq("operation_id", operationId)
      .order("created_at", { ascending: true })

    if (error) {
      return []
    }
    return data || []
  },

  async uploadOperationPhoto(
    operationId: number,
    file: File,
    category: "general" | "damage" | "interior" | "exterior" | "documents" = "general",
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient()

    // Upload to Supabase Storage
    const fileExt = file.name.split(".").pop()
    const fileName = `${operationId}-${Date.now()}.${fileExt}`
    const storagePath = `operations/${operationId}/${fileName}`

    const { error: uploadError } = await supabase.storage.from("operation-photos").upload(storagePath, file)

    if (uploadError) {
      // If bucket doesn't exist, skip photo upload gracefully
      if (uploadError.message?.includes("Bucket not found")) {
        return
      }
      throw uploadError
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("operation-photos").getPublicUrl(storagePath)

    // Insert record into operation_photos table
    const { error: insertError } = await supabase.from("operation_photos").insert({
      operation_id: operationId,
      file_url: publicUrl,
      storage_path: storagePath,
      category,
    })

    if (insertError) {
      throw insertError
    }
  },

  async checkCarAvailability(
    carId: number,
    startDate: string,
    endDate: string,
    excludeBookingId?: number,
  ): Promise<boolean> {
    const supabase = getSupabaseBrowserClient()

    try {
      let query = supabase
        .from("bookings")
        .select("id")
        .eq("car_id", carId)
        .in("status", ["pending", "confirmed"])
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)

      if (excludeBookingId) {
        query = query.neq("id", excludeBookingId)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      const isAvailable = !data || data.length === 0
      return isAvailable
    } catch (err: any) {
      return false
    }
  },
}
