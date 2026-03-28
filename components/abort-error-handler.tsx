"use client"

import { useEffect } from "react"

export function AbortErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason

      // Suppress AbortError - expected during navigation and React Strict Mode
      if (
        reason?.name === "AbortError" ||
        reason?.message?.includes("signal is aborted") ||
        reason?.message?.includes("aborted")
      ) {
        event.preventDefault()
        return
      }

      // Suppress timeout errors from withTimeout utility - already handled by catch blocks
      if (reason?.message?.startsWith("TIMEOUT:")) {
        event.preventDefault()
        return
      }

      // Log unexpected rejections for debugging
      console.error("[v0] Unhandled rejection:", reason?.message || reason)
    }

    const handleError = (event: ErrorEvent) => {
      // Suppress AbortError from error events too
      if (event.message?.includes("AbortError") || event.message?.includes("aborted")) {
        event.preventDefault()
        return
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleError)
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleError)
    }
  }, [])

  return null
}
