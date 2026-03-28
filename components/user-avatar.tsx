"use client"

import { useState } from "react"
import Image from "next/image"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
}

const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
}

/**
 * Get initials from a name (up to 2 characters)
 */
function getInitials(name?: string | null): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Generate a consistent background color based on name
 */
function getColorFromName(name?: string | null): string {
  if (!name) return "bg-gray-200"
  
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-teal-100 text-teal-700",
    "bg-indigo-100 text-indigo-700",
    "bg-cyan-100 text-cyan-700",
  ]
  
  // Simple hash based on name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}

export function UserAvatar({ src, name, size = "md", className }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  const showImage = src && !imageError
  const initials = getInitials(name)
  const colorClass = getColorFromName(name)

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full overflow-hidden flex-shrink-0",
        sizeClasses[size],
        !showImage && colorClass,
        className
      )}
    >
      {showImage ? (
        <Image
          src={src || "/placeholder.svg"}
          alt={name || "User avatar"}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : initials ? (
        <span className="font-medium select-none">{initials}</span>
      ) : (
        <User className={cn("text-gray-400", iconSizes[size])} />
      )}
    </div>
  )
}
