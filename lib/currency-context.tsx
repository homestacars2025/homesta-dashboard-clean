"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "./supabase-client"
import { useAuth } from "./auth-context"

type CurrencyCode = "TRY" | "USD" | "EUR"

interface CurrencyContextType {
  currency: CurrencyCode
  setCurrency: (c: CurrencyCode) => void
  symbol: string
  convertFromTRY: (tryValue: number) => number
  formatMoney: (tryValue: number, options?: { showSign?: boolean }) => string
}

const SYMBOLS: Record<CurrencyCode, string> = {
  TRY: "\u20BA",
  USD: "$",
  EUR: "\u20AC",
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "TRY",
  setCurrency: () => {},
  symbol: "\u20BA",
  convertFromTRY: (v) => v,
  formatMoney: (v) => `\u20BA${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { initialAuthChecked, user } = useAuth()
  const [currency, setCurrency] = useState<CurrencyCode>("TRY")
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 1, EUR: 1 })

  // Only fetch exchange rates AFTER auth has resolved and a user exists.
  // Firing this query before auth is ready can race with the auth-context's
  // session validation and cause downstream pages to see "session expired".
  useEffect(() => {
    if (!initialAuthChecked || !user) return

    async function fetchRates() {
      try {
        const supabase = getSupabaseBrowserClient()
        if (!supabase) return
        const { data } = await supabase
          .from("exchange_rates")
          .select("currency, rate_to_try")
          .in("currency", ["USD", "EUR"])
        if (data) {
          const usd = data.find((r) => r.currency === "USD")?.rate_to_try || 1
          const eur = data.find((r) => r.currency === "EUR")?.rate_to_try || 1
          setRates({ USD: usd, EUR: eur })
        }
      } catch {
        // Silently fail - keep default rates
      }
    }
    fetchRates()
  }, [initialAuthChecked, user])

  const convertFromTRY = useCallback(
    (tryValue: number): number => {
      if (currency === "TRY") return tryValue
      const rate = rates[currency]
      if (!rate || rate === 0) return tryValue
      return tryValue / rate
    },
    [currency, rates],
  )

  const formatMoney = useCallback(
    (tryValue: number, options?: { showSign?: boolean }): string => {
      const converted = convertFromTRY(tryValue)
      const sym = SYMBOLS[currency]
      const formatted = Math.abs(converted).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      if (options?.showSign) {
        const sign = converted >= 0 ? "+" : "-"
        return `${sign}${sym}${formatted}`
      }
      return `${sym}${formatted}`
    },
    [currency, convertFromTRY],
  )

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        symbol: SYMBOLS[currency],
        convertFromTRY,
        formatMoney,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
