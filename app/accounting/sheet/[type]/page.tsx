"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Car, ShoppingBag, Building2, User, ChevronRight, Search, X } from "lucide-react"
import { getCarsForInvestor } from "@/lib/financial-service"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { useCurrency } from "@/lib/currency-context"

type Transaction = {
  id: number
  date: string
  sheet_type: "car" | "buy_sell" | "company_expenses" | "personal_expenses"
  category: string
  direction: "IN" | "OUT"
  amount: number
  note: string | null
  car_id: number | null
}

type SheetCard = {
  id: string
  name: string
  description: string
  type: "car" | "buy_sell" | "company_expenses" | "personal_expenses"
  icon: any
  iconColor: string
  carId?: number
}

export default function SheetsOverviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { formatMoney, symbol } = useCurrency()
  const [investorId, setInvestorId] = useState<string>("")
  const [investorName, setInvestorName] = useState<string>("")
  const [month, setMonth] = useState<string>("")
  const [cars, setCars] = useState<Array<{ id: number; plate_number: string; model_group: { name: string; brand: string; model: string } | null }>>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sheets, setSheets] = useState<SheetCard[]>([])
  const [selectedSheet, setSelectedSheet] = useState<SheetCard | null>(null)
  const [sheetTransactions, setSheetTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    const investorIdParam = searchParams.get("investor_id") || ""
    const investorParam = searchParams.get("investor") || ""
    const monthKey = searchParams.get("month") || ""

    setInvestorId(investorIdParam)
    setInvestorName(investorParam)
    setMonth(monthKey)

    async function loadData() {
      try {
        const supabase = getSupabaseBrowserClient()

        // Load cars - if investorId provided, filter by it; otherwise load all
        let carsData: Array<{ id: number; plate_number: string; model_group: { name: string; brand: string; model: string } | null }> = []
        if (investorIdParam) {
          carsData = await getCarsForInvestor(investorIdParam)
        } else {
          const { data } = await supabase.from("cars").select("id, plate_number, model_group(name, brand, model)").order("plate_number")
          carsData = data || []
        }

        let transactionsQuery = supabase.from("financial_transactions").select("*").order("date", { ascending: false })

        // Apply investor filter if provided
        if (investorIdParam) {
          transactionsQuery = transactionsQuery.eq("investor_id", investorIdParam)
        }

        // Apply month filter if provided - calculate date range from month
        if (monthKey) {
          const [year, monthNum] = monthKey.split("-").map(Number)
          const dateFrom = `${year}-${String(monthNum).padStart(2, "0")}-01`
          const lastDay = new Date(year, monthNum, 0).getDate()
          const dateTo = `${year}-${String(monthNum).padStart(2, "0")}-${lastDay}`
          transactionsQuery = transactionsQuery.gte("date", dateFrom).lte("date", dateTo)
        }

        const { data: transactionsData, error: transError } = await transactionsQuery

        if (transError) {
          console.error("[v0] Failed to load transactions:", transError)
        }

        setCars(carsData)
        setTransactions((transactionsData || []) as Transaction[])

        // Build sheet cards
        const sheetCards: SheetCard[] = []

        sheetCards.push(
          {
            id: "company_expenses",
            name: "Company Expenses",
            description: "Business operational expenses",
            type: "company_expenses",
            icon: Building2,
            iconColor: "text-red-600",
          },
          {
            id: "personal_expenses",
            name: "Personal Expenses",
            description: "Personal withdrawal transactions",
            type: "personal_expenses",
            icon: User,
            iconColor: "text-orange-600",
          },
          {
            id: "buy_sell",
            name: "Buy & Sell",
            description: "Purchase and sale transactions",
            type: "buy_sell",
            icon: ShoppingBag,
            iconColor: "text-green-600",
          },
        )

        carsData.forEach((car: any) => {
          // getCarsForInvestor returns cars with model_group: { name: "..." }
          const modelName = car.model_group?.name || ""
          sheetCards.push({
            id: `car-${car.id}`,
            name: `${car.plate_number}${modelName ? ` - ${modelName}` : ""}`,
            description: modelName || "No model assigned",
            type: "car",
            icon: Car,
            iconColor: "text-[#4AA3FF]",
            carId: car.id,
          })
        })

        setSheets(sheetCards)
      } catch (error) {
        console.error("Failed to load sheet data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [searchParams])

  const getSheetStats = (sheet: SheetCard) => {
    const sheetTransactions = transactions.filter((t) => {
      if (sheet.type === "car" && sheet.carId !== undefined) {
        return t.sheet_type === "car" && t.car_id === sheet.carId
      }
      return t.sheet_type === sheet.type
    })

    const recordCount = sheetTransactions.length

    const totalIn = sheetTransactions.filter((t) => t.direction === "IN").reduce((sum, t) => sum + Number(t.amount), 0)

    const totalOut = sheetTransactions
      .filter((t) => t.direction === "OUT")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalBalance = totalIn - totalOut

    return { recordCount, totalBalance }
  }

  const filteredSheets = sheets.filter((sheet) => sheet.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleSheetClick = (sheet: SheetCard) => {
    const filtered = transactions.filter((t) => {
      if (sheet.type === "car" && sheet.carId !== undefined) {
        return t.sheet_type === "car" && t.car_id === sheet.carId
      }
      return t.sheet_type === sheet.type
    })
    setSheetTransactions(filtered)
    setSelectedSheet(sheet)
  }

  const handleCloseDetail = () => {
    setSelectedSheet(null)
    setSheetTransactions([])
  }

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return
    }

    try {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase.from("financial_transactions").delete().eq("id", transactionId)

      if (error) {
        alert(`Failed to delete transaction: ${error.message}`)
        return
      }

      setSheetTransactions((prev) => prev.filter((t) => t.id !== transactionId))
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId))

      alert("Transaction deleted successfully")
    } catch (error) {
      alert("Failed to delete transaction. Please try again.")
      console.error("[v0] Delete error:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AA3FF] mx-auto"></div>
          <p className="mt-4 text-[#64748B]">Loading sheets...</p>
        </div>
      </div>
    )
  }

  if (selectedSheet) {
    const Icon = selectedSheet.icon
    const { totalBalance } = getSheetStats(selectedSheet)

    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleCloseDetail}
                className="border-[#E2E8F0] hover:bg-white transition-colors bg-transparent"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#4AA3FF]/10">
                  <Icon className="h-6 w-6 text-[#4AA3FF]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1E293B]">{selectedSheet.name}</h1>
                  <p className="text-sm text-[#64748B]">{selectedSheet.description}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#64748B]">Total Balance</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatMoney(totalBalance)}
              </p>
            </div>
          </div>

          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-0">
              {sheetTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[#64748B]">No transactions found for this sheet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#4AA3FF]/5 to-[#4AA3FF]/10 sticky top-0 z-10">
                      <tr className="border-b-2 border-[#4AA3FF]/20">
                        <th className="text-left py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide w-[130px]">
                          Date
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide w-[100px]">
                          Direction
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide w-[150px]">
                          Category
                        </th>
                        <th className="text-right py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide w-[140px]">
                          Amount (₺)
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide min-w-[300px]">
                          Description
                        </th>
                        <th className="text-right py-4 px-6 text-sm font-bold text-[#1E293B] uppercase tracking-wide w-[120px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {sheetTransactions.map((transaction, index) => (
                        <tr
                          key={transaction.id}
                          className={`transition-all duration-150 hover:bg-[#4AA3FF]/5 ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          } ${
                            transaction.direction === "IN"
                              ? "border-l-4 border-l-green-500"
                              : "border-l-4 border-l-red-500"
                          }`}
                        >
                          <td className="py-4 px-6">
                            <span className="text-[#64748B] font-medium">
                              {new Date(transaction.date).toLocaleDateString("tr-TR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${
                                transaction.direction === "IN"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}
                            >
                              {transaction.direction === "IN" ? "↓ IN" : "↑ OUT"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-[#1E293B] font-medium">{transaction.category || "—"}</span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className="font-bold text-[#1E293B] text-base">
                              {Number(transaction.amount).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-[#1E293B] leading-relaxed whitespace-pre-wrap break-words">
                              {transaction.direction === "OUT" && transaction.note?.toLowerCase().includes("commission")
                                ? "Homesta COM"
                                : transaction.note || "—"}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTransaction(transaction.id)}
                              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-semibold"
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1E293B]">Financial Sheets</h1>
            <p className="text-[#64748B] mt-1">
              {investorName ? `${investorName} - ` : ""}
              {month || "All Records"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="border-[#E2E8F0] hover:bg-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#64748B]" />
          <Input
            type="text"
            placeholder="Search sheets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 border-[#E2E8F0] focus:border-[#4AA3FF] focus:ring-[#4AA3FF] rounded-xl"
          />
        </div>

        {filteredSheets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#64748B] text-lg">No sheets found matching your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSheets.map((sheet) => {
              const { recordCount, totalBalance } = getSheetStats(sheet)
              const Icon = sheet.icon

              return (
                <Card
                  key={sheet.id}
                  className="group cursor-pointer border-[#E2E8F0] hover:border-[#4AA3FF] transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-[14px] overflow-hidden bg-white"
                  onClick={() => handleSheetClick(sheet)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 rounded-xl bg-[#4AA3FF]/10">
                        <Icon className="h-6 w-6 text-[#4AA3FF]" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#64748B] group-hover:text-[#4AA3FF] group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-[#1E293B] group-hover:text-[#4AA3FF] transition-colors">
                        {sheet.name}
                      </h3>
                      <p className="text-sm text-[#64748B] line-clamp-2">{sheet.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-sm">
                      <div>
                        <p className="text-[#64748B]">Records</p>
                        <p className="font-semibold text-[#1E293B] mt-0.5">{recordCount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#64748B]">Total Balance</p>
                        <p className={`font-semibold mt-0.5 ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatMoney(totalBalance)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
