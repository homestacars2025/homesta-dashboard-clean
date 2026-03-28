import { getSupabaseBrowserClient } from "./supabase-client"

const AVATAR_BUCKET = "profile_avatars"
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export interface AvatarUploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Validates an image file for avatar upload
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload JPG, PNG, or WebP images only.",
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File too large. Maximum size is 2MB.",
    }
  }

  return { valid: true }
}

/**
 * Converts an image file to a compressed base64 data URL
 * This avoids Supabase Storage RLS issues by storing directly in the profiles table
 */
function fileToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.7))
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads an avatar image by converting to data URL and storing in profiles table
 * @param file The image file to upload
 * @param userId The user's profile ID
 * @returns The data URL of the uploaded image or error
 */
export async function uploadAvatar(file: File, userId: string): Promise<AvatarUploadResult> {
  const validation = validateAvatarFile(file)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  try {
    const dataUrl = await fileToDataUrl(file)
    return { success: true, url: dataUrl }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to process avatar" }
  }
}

/**
 * Updates the avatar_url in the profiles table
 * @param userId The user's profile ID
 * @param avatarUrl The new avatar URL (or null to remove)
 */
export async function updateProfileAvatar(userId: string, avatarUrl: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)

    if (error) {
      console.error("[v0] Profile avatar update error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Profile avatar update failed:", error)
    return { success: false, error: error.message || "Failed to update avatar" }
  }
}

/**
 * Uploads avatar and updates profile in one operation
 */
export async function uploadAndSaveAvatar(file: File, userId: string): Promise<AvatarUploadResult> {
  // First upload the file
  const uploadResult = await uploadAvatar(file, userId)
  if (!uploadResult.success || !uploadResult.url) {
    return uploadResult
  }

  // Then update the profile
  const updateResult = await updateProfileAvatar(userId, uploadResult.url)
  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  return { success: true, url: uploadResult.url }
}

/**
 * Deletes old avatar from storage (cleanup)
 */
export async function deleteOldAvatar(oldUrl: string): Promise<void> {
  if (!oldUrl || !oldUrl.includes(AVATAR_BUCKET)) return

  try {
    const supabase = getSupabaseBrowserClient()
    
    // Extract the path from the URL
    const urlParts = oldUrl.split(`/${AVATAR_BUCKET}/`)
    if (urlParts.length > 1) {
      const storagePath = urlParts[1]
      await supabase.storage.from(AVATAR_BUCKET).remove([storagePath])
    }
  } catch (error) {
    // Silent fail - old avatar cleanup is not critical
    console.error("[v0] Failed to delete old avatar:", error)
  }
}
