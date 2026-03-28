"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Trash2, Printer, Download } from "lucide-react"
import AccountingStatementPrint from "@/components/print/AccountingStatementPrint"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { useAuth } from "@/lib/auth-context"
import { useCurrency } from "@/lib/currency-context"
import { withSessionRetry } from "@/lib/with-session-retry"

interface LedgerEntry {
  id: number
  booking_id: number
  customer_id: string
  car_id: number
  transaction_type: string
  description: string
  amount: number
  direction: "IN" | "OUT"
  created_at: string
  created_by: string | null
}

interface BookingDetails {
  id: number
  booking_number: string
  customer_name: string
  customer_id: string
  car_id: number
  start_date: string
  end_date: string
}

export default function CustomerAccountingSheetPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { initialAuthChecked, user } = useAuth()
  const { formatMoney, symbol } = useCurrency()
  const bookingId = Number(params.bookingId)
  const printRef = useRef<HTMLDivElement>(null)
  const [printPortalMounted, setPrintPortalMounted] = useState(false)

  useEffect(() => { setPrintPortalMounted(true) }, [])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newEntry, setNewEntry] = useState({
    type: "PAYMENT",
    direction: "IN" as "IN" | "OUT",
    amount: "",
    description: "",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
  })

  const [totalCharges, setTotalCharges] = useState<number>(0)
  const [totalPaid, setTotalPaid] = useState<number>(0)

  useEffect(() => {
    if (initialAuthChecked && user) {
      loadData()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }
  }, [bookingId, initialAuthChecked, user])

  const loadData = async () => {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()

    try {
      // Load booking details (withSessionRetry auto-refreshes token on 401)
      const { data: bookingData, error: bookingError} = await withSessionRetry(() =>
        supabase
          .from("bookings")
          .select("id, booking_number, customer_id, car_id, start_date, end_date, customers!bookings_customer_id_fkey(first_name, last_name)")
          .eq("id", bookingId)
          .single()
      )

      if (bookingError) throw bookingError

      setBooking({
        id: bookingData.id,
        booking_number: bookingData.booking_number,
        customer_id: bookingData.customer_id,
        car_id: bookingData.car_id,
        customer_name: bookingData.customers
          ? `${bookingData.customers.first_name || ""} ${bookingData.customers.last_name || ""}`.trim()
          : "Unknown",
        start_date: bookingData.start_date,
        end_date: bookingData.end_date,
      })

      // Load ledger entries
      const { data: ledgerData, error: ledgerError } = await withSessionRetry(() =>
        supabase
          .from("customer_accounting_ledger")
          .select("*")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
      )

      if (ledgerError) throw ledgerError

      setLedgerEntries(ledgerData || [])
      const charges = ledgerData.filter((e) => e.direction === "OUT").reduce((sum, e) => sum + e.amount, 0)
      const paid = ledgerData.filter((e) => e.direction === "IN").reduce((sum, e) => sum + e.amount, 0)
      setTotalCharges(charges)
      setTotalPaid(paid)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load accounting data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async () => {
    if (!newEntry.amount || Number(newEntry.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    if (!newEntry.type) {
      toast({
        title: "Validation Error",
        description: "Please enter a transaction type",
        variant: "destructive",
      })
      return
    }

    if (!booking) return

    setIsSubmitting(true)
    const supabase = getSupabaseBrowserClient()

    try {
      const { error } = await supabase.from("customer_accounting_ledger").insert({
        booking_id: bookingId,
        customer_id: booking.customer_id,
        car_id: booking.car_id,
        type: newEntry.type,
        transaction_type: newEntry.type,
        direction: newEntry.direction,
        amount: Number(newEntry.amount),
        description: newEntry.description,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Transaction added successfully",
      })

      setIsAddDialogOpen(false)
      setNewEntry({
        type: "PAYMENT",
        direction: "IN",
        amount: "",
        description: "",
      })
      await loadData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return

    const supabase = getSupabaseBrowserClient()

    try {
      const { error } = await supabase.from("customer_accounting_ledger").delete().eq("id", entryId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      })

      await loadData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      })
    }
  }

  // Calculate balance based on direction: IN - OUT
  const totalIn = ledgerEntries
    .filter((e) => e.direction === "IN")
    .reduce((sum, e) => sum + e.amount, 0)

  const totalOut = ledgerEntries
    .filter((e) => e.direction === "OUT")
    .reduce((sum, e) => sum + e.amount, 0)

  const balance = totalIn - totalOut

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5BC0F8] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading accounting data...</p>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <ArrowLeft className="h-6 w-6 text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold text-center text-slate-800">Booking Not Found</h2>
            <p className="text-slate-600 text-center">The booking you're looking for doesn't exist.</p>
            <Button
              onClick={() => router.push("/accounting/customer")}
              className="w-full h-10 px-5 text-white font-medium rounded-lg shadow-md"
              style={{ backgroundColor: "#5BC0F8" }}
            >
              Back to Customer Accounting
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push("/accounting/customer")} 
            className="mb-2 -ml-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">Accounting Sheet</h1>
          <p className="text-slate-500 text-sm">Booking #{booking.booking_number} - {booking.customer_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="gap-2 text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            onClick={handlePrint}
            className="gap-2 text-white font-medium"
            style={{ backgroundColor: "#5BC0F8" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Save PDF</span>
          </Button>
        </div>
      </div>

      {/* Main Balance Card */}
      <Card className={`border-0 shadow-lg overflow-hidden ${balance >= 0 ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-red-600"}`}>
        <CardContent className="p-8">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Current Balance</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold">
                  {formatMoney(balance, { showSign: true })}
                </span>
                <span className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-white/20`}>
                  {balance >= 0 ? "Credit" : "Debit"}
                </span>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-white/60 text-xs">Booking Period</p>
                <p className="text-sm font-medium">{format(new Date(booking.start_date), "MMM dd")} - {format(new Date(booking.end_date), "MMM dd, yyyy")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
          <h2 className="text-lg font-semibold text-slate-800">Financial Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Income</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Total IN</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(totalIn)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-rose-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                </div>
                <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Expense</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Total OUT</p>
              <p className="text-2xl font-bold text-rose-600">{formatMoney(totalOut)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${balance >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                  <span className={`text-lg font-bold ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>=</span>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${balance >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}>
                  {balance >= 0 ? "Positive" : "Negative"}
                </span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Net Balance</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(balance)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-violet-500 rounded-full"></div>
          <h2 className="text-lg font-semibold text-slate-800">Transaction History</h2>
        </div>
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700">All Transactions</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="text-white font-medium rounded-xl"
                    style={{ backgroundColor: "#5BC0F8" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Input
                        placeholder="e.g., Payment, Deposit, Refund, Damage Charge"
                        value={newEntry.type}
                        onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <Select
                        value={newEntry.direction}
                        onValueChange={(value: "IN" | "OUT") =>
                          setNewEntry({ ...newEntry, direction: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">IN (Money received from customer)</SelectItem>
                          <SelectItem value="OUT">OUT (Money paid to customer / refund)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newEntry.amount}
                        onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Enter transaction details..."
                        value={newEntry.description}
                        onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newEntry.transaction_date}
                        onChange={(e) => setNewEntry({ ...newEntry, transaction_date: e.target.value })}
                      />
                    </div>

                    <Button
                      onClick={handleAddEntry}
                      disabled={isSubmitting}
                      className="w-full text-white font-medium rounded-xl"
                      style={{ backgroundColor: "#5BC0F8" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
                    >
                      {isSubmitting ? "Adding..." : "Add Transaction"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="text-slate-600 font-semibold">Date</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Type</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Description</TableHead>
                  <TableHead className="text-right text-emerald-600 font-semibold">IN</TableHead>
                  <TableHead className="text-right text-rose-600 font-semibold">OUT</TableHead>
                  <TableHead className="text-right text-slate-600 font-semibold">Balance</TableHead>
                  <TableHead className="text-right text-slate-600 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Plus className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium">No transactions yet</p>
                        <p className="text-slate-400 text-sm">Add your first transaction to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerEntries.map((entry) => {
                    let runningBalance = 0
                    if (entry.direction === "IN") {
                      runningBalance += entry.amount
                    } else {
                      runningBalance -= entry.amount
                    }
                    return (
                      <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-slate-600">{format(new Date(entry.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${entry.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {entry.transaction_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600">{entry.description || "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {entry.direction === "IN" ? formatMoney(entry.amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-rose-600">
                          {entry.direction === "OUT" ? formatMoney(entry.amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-800">
                          {formatMoney(runningBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Print portal -- rendered into body so @media print can isolate it */}
      {printPortalMounted && booking && createPortal(
        <div className="print-portal">
          <AccountingStatementPrint
            ref={printRef}
            booking={booking}
            ledgerEntries={ledgerEntries}
            totalIn={totalIn}
            totalOut={totalOut}
            balance={balance}
            formatMoney={formatMoney}
            currencySymbol={symbol}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
