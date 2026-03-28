"use client"

import type React from "react"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight } from "lucide-react"

const MOCK_CARS = ["Renault Clio", "Toyota Corolla", "Hyundai Accent"]

const INCOME_CATEGORIES = ["إيجار", "بيع", "أخرى"]
const EXPENSE_CATEGORIES = ["عمولة", "بنزين", "تغيير زيت", "صيانة", "أخرى"]

export default function AddTransaction() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const investor = searchParams.get("investor")
  const month = searchParams.get("month")

  const [sheetType, setSheetType] = useState<string>("")
  const [direction, setDirection] = useState<string>("")
  const [car, setCar] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [amount, setAmount] = useState<string>("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock submit - show success message
    alert("تم حفظ العملية بنجاح!")
    router.push(`/investor-dashboard/report?investor=${encodeURIComponent(investor || "")}&month=${month}`)
  }

  const categories = direction === "دخول" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <CardTitle className="text-2xl">إضافة عملية مالية</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  {investor} - {month}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Sheet Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">نوع الشيت</label>
                <Select value={sheetType} onValueChange={setSheetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الشيت" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cars">سيارات</SelectItem>
                    <SelectItem value="buy-sell">بيع / شراء</SelectItem>
                    <SelectItem value="company-expenses">مصاريف شركة</SelectItem>
                    <SelectItem value="personal-expenses">مصاريف شخصية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Direction */}
              {sheetType && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع العملية</label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع العملية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="دخول">دخول</SelectItem>
                      <SelectItem value="خروج">خروج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 3: Dynamic Fields */}
              {direction && (
                <>
                  {sheetType === "cars" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">السيارة</label>
                      <Select value={car} onValueChange={setCar}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر السيارة" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_CARS.map((carName) => (
                            <SelectItem key={carName} value={carName}>
                              {carName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">التصنيف</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">القيمة (ر.س)</label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="أدخل المبلغ"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">التوضيح</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="أضف تفاصيل إضافية..."
                      rows={4}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={!amount || !category}>
                  حفظ
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
