"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/login")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-3 rounded-full mx-auto mb-3" style={{ borderColor: "#e2e8f0", borderTopColor: "#5BC0F8" }} />
        <p className="text-slate-400 text-xs">Redirecting...</p>
      </div>
    </div>
  )
}
