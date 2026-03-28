"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Menu,
  LogOut,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { useCurrency } from "@/lib/currency-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const LOGO_LIGHT = "/images/hc-20logo.png"
const LOGO_DARK = "/images/untitled-1.png"

// Modern minimal icons as SVG components (Apple/Airbnb style)
const IconHome = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9,22 9,12 15,12 15,22" />
  </svg>
)

const IconLayers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12,2 2,7 12,12 22,7" />
    <polyline points="2,17 12,22 22,17" />
    <polyline points="2,12 12,17 22,12" />
  </svg>
)

const IconCar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z" />
    <path d="M5 17H3v-4l2-5h10l4 5h2v4h-2M5 17h10" />
    <path d="M14 8l-4 0" />
  </svg>
)

const IconToll = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8h4" />
    <path d="M7 12h10" />
    <path d="M7 16h6" />
  </svg>
)

const IconFine = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconBooking = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M9 16l2 2 4-4" />
  </svg>
)

const IconCalendar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const IconWrench = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
)

const IconCalculator = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10.01" />
    <line x1="12" y1="10" x2="12" y2="10.01" />
    <line x1="16" y1="10" x2="16" y2="10.01" />
    <line x1="8" y1="14" x2="8" y2="14.01" />
    <line x1="12" y1="14" x2="12" y2="14.01" />
    <line x1="16" y1="14" x2="16" y2="14.01" />
    <line x1="8" y1="18" x2="8" y2="18.01" />
    <line x1="12" y1="18" x2="12" y2="18.01" />
    <line x1="16" y1="18" x2="16" y2="18.01" />
  </svg>
)

const IconUsers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)

const IconBriefcase = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
  </svg>
)

const IconSettings = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

// Navigation items with role-based visibility - REORDERED as requested
const navigation = [
  { name: "General", href: "/general", icon: IconHome, allowedRoles: ["admin", "staff"] },
  { name: "Model Groups", href: "/dashboard/model-groups", icon: IconLayers, allowedRoles: ["admin"] },
  { name: "Cars", href: "/dashboard/cars", icon: IconCar },
  { name: "KGM Tolls", href: "/dashboard/kgm", icon: IconToll, allowedRoles: ["admin", "staff"] },
  { name: "Traffic Fines", href: "/dashboard/traffic-fines", icon: IconFine, allowedRoles: ["admin", "staff"] },
  { name: "Bookings", href: "/dashboard/bookings", icon: IconBooking, allowedRoles: ["admin", "staff"] },
  { name: "Availability", href: "/dashboard/availability", icon: IconCalendar },
  { name: "Operations", href: "/dashboard/operations", icon: IconWrench, allowedRoles: ["admin", "staff"] },
  { name: "Accounting", href: "/accounting", icon: IconCalculator, allowedRoles: ["admin", "investor"], investorRedirect: true },
  { name: "Users", href: "/dashboard/users", icon: IconUsers, allowedRoles: ["admin", "staff"] },
  { name: "Investors", href: "/dashboard/investors", icon: IconBriefcase, allowedRoles: ["admin"] },
  { name: "Settings", href: "/settings", icon: IconSettings },
]

// Brand color for hover/active states
const BRAND_COLOR = "#4ba6ea"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currency, setCurrency } = useCurrency()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const visibleNavigation = navigation.filter((item) => {
    if (item.allowedRoles) {
      return user?.role && item.allowedRoles.includes(user.role)
    }
    return true
  })

  // Navigation item component with premium styling
  const NavItem = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    const Icon = item.icon
    let href = item.href
    if (item.investorRedirect && user?.role === "investor" && user?.investorId) {
      href = `/accounting/investor/${user.investorId}`
    }
    const isActive = pathname === href || (item.investorRedirect && pathname.startsWith("/accounting") && user?.role === "investor")

    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-out",
          isActive
            ? "text-[#4ba6ea] bg-[#4ba6ea]/10 font-semibold"
            : "text-gray-600 hover:text-[#4ba6ea] hover:bg-[#4ba6ea]/5"
        )}
      >
        {/* Active indicator bar */}
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-all duration-200",
            isActive ? "bg-[#4ba6ea]" : "bg-transparent group-hover:bg-[#4ba6ea]/30"
          )}
        />
        <Icon
          className={cn(
            "h-5 w-5 flex-shrink-0 transition-colors duration-200",
            isActive ? "text-[#4ba6ea]" : "text-gray-400 group-hover:text-[#4ba6ea]"
          )}
        />
        <span className="truncate">{item.name}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center h-16 px-4 bg-white border-b border-gray-100">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-gray-600" />
            </Button>
          </SheetTrigger>
          <Link href="/dashboard" className="flex items-center ml-4">
            <Image
              src={LOGO_LIGHT || "/placeholder.svg"}
              alt="Homesta Cars"
              width={120}
              height={36}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src={LOGO_DARK || "/placeholder.svg"}
              alt="Homesta Cars"
              width={120}
              height={36}
              className="object-contain hidden dark:block"
              priority
            />
          </Link>
        </header>

        <SheetContent side="left" className="w-72 p-0 border-0">
          <div className="flex flex-col h-full bg-white">
            <Link href="/dashboard" className="flex items-center p-6 border-b border-gray-100">
              <Image
                src={LOGO_LIGHT || "/placeholder.svg"}
                alt="Homesta Cars"
                width={140}
                height={42}
                className="object-contain dark:hidden"
                priority
              />
              <Image
                src={LOGO_DARK || "/placeholder.svg"}
                alt="Homesta Cars"
                width={140}
                height={42}
                className="object-contain hidden dark:block"
                priority
              />
            </Link>
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {visibleNavigation.map((item) => (
                <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Currency</p>
                <Select value={currency} onValueChange={(v) => setCurrency(v as "TRY" | "USD" | "EUR")}>
                  <SelectTrigger className="h-9 text-sm border-gray-200 focus:border-[#4ba6ea] focus:ring-[#4ba6ea]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50">
                <UserAvatar
                  src={user?.avatar_url}
                  name={user?.name || user?.email || "User"}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate capitalize">{user?.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl py-3 transition-colors duration-200"
                onClick={() => { setSidebarOpen(false); handleLogout(); }}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-100">
          <Link
            href="/dashboard"
            className="flex items-center h-16 px-6 border-b border-gray-100 hover:opacity-90 transition-opacity"
          >
            <Image
              src={LOGO_LIGHT || "/placeholder.svg"}
              alt="Homesta Cars"
              width={140}
              height={42}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src={LOGO_DARK || "/placeholder.svg"}
              alt="Homesta Cars"
              width={140}
              height={42}
              className="object-contain hidden dark:block"
              priority
            />
          </Link>
          <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
            {visibleNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>
          <div className="p-4 border-t border-gray-100 space-y-3">
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Currency</p>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "TRY" | "USD" | "EUR")}>
                <SelectTrigger className="h-9 text-sm border-gray-200 focus:border-[#4ba6ea] focus:ring-[#4ba6ea]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50">
              <UserAvatar
                src={user?.avatar_url}
                name={user?.name || user?.email || "User"}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate capitalize">{user?.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl py-3 transition-colors duration-200"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="py-6 px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
