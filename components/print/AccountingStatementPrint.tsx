"use client"

import { forwardRef } from "react"
import { format } from "date-fns"

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

interface AccountingStatementPrintProps {
  booking: BookingDetails
  ledgerEntries: LedgerEntry[]
  totalIn: number
  totalOut: number
  balance: number
  formatMoney: (value: number, options?: { showSign?: boolean }) => string
  currencySymbol: string
}

const AccountingStatementPrint = forwardRef<HTMLDivElement, AccountingStatementPrintProps>(
  ({ booking, ledgerEntries, totalIn, totalOut, balance, formatMoney, currencySymbol }, ref) => {
    const today = new Date()
    const statementId = `HC-${booking.booking_number}-${format(today, "yyyyMMdd")}`

    // Sort entries by date ascending for the printed statement
    const sortedEntries = [...ledgerEntries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Compute running balance for each row
    let runningBalance = 0
    const entriesWithBalance = sortedEntries.map((entry) => {
      if (entry.direction === "IN") {
        runningBalance += entry.amount
      } else {
        runningBalance -= entry.amount
      }
      return { ...entry, runningBalance }
    })

    return (
      <div ref={ref} className="print-statement">
        {/* ── Header ── */}
        <div className="print-header">
          <div className="print-header-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hc-20logo.png"
              alt="Homesta Cars"
              className="print-logo"
              crossOrigin="anonymous"
            />
          </div>
          <div className="print-header-right">
            <h1 className="print-title">Accounting Statement</h1>
            <p className="print-meta">Statement ID: {statementId}</p>
            <p className="print-meta">Date: {format(today, "MMMM dd, yyyy")}</p>
          </div>
        </div>

        <div className="print-divider" />

        {/* ── Booking / Customer Info ── */}
        <div className="print-info-grid">
          <div className="print-info-block">
            <h3 className="print-info-label">Customer</h3>
            <p className="print-info-value">{booking.customer_name}</p>
          </div>
          <div className="print-info-block">
            <h3 className="print-info-label">Booking</h3>
            <p className="print-info-value">#{booking.booking_number}</p>
          </div>
          <div className="print-info-block">
            <h3 className="print-info-label">Period</h3>
            <p className="print-info-value">
              {format(new Date(booking.start_date), "MMM dd, yyyy")} &mdash;{" "}
              {format(new Date(booking.end_date), "MMM dd, yyyy")}
            </p>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="print-summary-row">
          <div className="print-summary-card">
            <span className="print-summary-label">Total IN</span>
            <span className="print-summary-value print-color-green">{formatMoney(totalIn)}</span>
          </div>
          <div className="print-summary-card">
            <span className="print-summary-label">Total OUT</span>
            <span className="print-summary-value print-color-red">{formatMoney(totalOut)}</span>
          </div>
          <div className="print-summary-card print-summary-card-highlight">
            <span className="print-summary-label">Net Balance</span>
            <span className={`print-summary-value ${balance >= 0 ? "print-color-green" : "print-color-red"}`}>
              {formatMoney(balance, { showSign: true })}
            </span>
          </div>
        </div>

        {/* ── Transactions Table ── */}
        <h2 className="print-section-title">Transaction History</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th className="print-th">Date</th>
              <th className="print-th">Type</th>
              <th className="print-th">Description</th>
              <th className="print-th print-th-right">IN</th>
              <th className="print-th print-th-right">OUT</th>
              <th className="print-th print-th-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {entriesWithBalance.length === 0 ? (
              <tr>
                <td colSpan={6} className="print-td" style={{ textAlign: "center", padding: "24px 12px", color: "#94a3b8" }}>
                  No transactions recorded
                </td>
              </tr>
            ) : (
              entriesWithBalance.map((entry, idx) => (
                <tr key={entry.id} className={idx % 2 === 0 ? "print-row-even" : ""}>
                  <td className="print-td">{format(new Date(entry.created_at), "MMM dd, yyyy")}</td>
                  <td className="print-td">
                    <span className={`print-badge ${entry.direction === "IN" ? "print-badge-green" : "print-badge-red"}`}>
                      {entry.transaction_type}
                    </span>
                  </td>
                  <td className="print-td">{entry.description || "-"}</td>
                  <td className="print-td print-td-right print-color-green">
                    {entry.direction === "IN" ? formatMoney(entry.amount) : "-"}
                  </td>
                  <td className="print-td print-td-right print-color-red">
                    {entry.direction === "OUT" ? formatMoney(entry.amount) : "-"}
                  </td>
                  <td className="print-td print-td-right" style={{ fontWeight: 600 }}>
                    {formatMoney(entry.runningBalance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Footer ── */}
        <div className="print-divider" style={{ marginTop: "32px" }} />
        <div className="print-footer">
          <p>Homesta Cars &middot; Istanbul, Turkey</p>
          <p>Generated by Homesta Cars System &middot; {format(today, "MMMM dd, yyyy 'at' HH:mm")}</p>
        </div>
      </div>
    )
  }
)

AccountingStatementPrint.displayName = "AccountingStatementPrint"

export default AccountingStatementPrint
