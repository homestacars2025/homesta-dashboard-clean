'use server'

import { getSupabaseServerClient } from '@/lib/supabase-server'

type SerializedFile = {
  name: string
  type: string
  size: number
  arrayBuffer: number[] // ArrayBuffer serialized as number array
}

export async function uploadOperationPhotos(
  operationId: number,
  serializedFiles: SerializedFile[]
) {
  console.log("[v0] uploadOperationPhotos - Called with operationId:", operationId)
  console.log("[v0] uploadOperationPhotos - Files count:", serializedFiles?.length || 0)
  
  const supabase = await getSupabaseServerClient()
  console.log("[v0] uploadOperationPhotos - Supabase client obtained")
  
  const uploadedPhotos: string[] = []

  try {
    for (const file of serializedFiles) {
      console.log("[v0] uploadOperationPhotos - Processing file:", file.name, "Size:", file.size, "Type:", file.type)
      try {
        // Generate unique filename with UUID
        const fileExtension = file.name.split('.').pop() || 'jpg'
        const uuid = crypto.randomUUID()
        const fileName = `${uuid}.${fileExtension}`
        const filePath = `operations/${operationId}/${fileName}`
        console.log("[v0] uploadOperationPhotos - Generated path:", filePath)

        // Convert serialized array back to buffer, then to Blob
        const buffer = Buffer.from(file.arrayBuffer)
        console.log("[v0] uploadOperationPhotos - Buffer created, size:", buffer.length)
        
        // Create Blob from buffer (Supabase storage expects Blob/File, not raw Buffer)
        const blob = new Blob([buffer], { type: file.type })
        console.log("[v0] uploadOperationPhotos - Blob created, size:", blob.size, "type:", blob.type)

        // Upload to Supabase Storage
        console.log("[v0] uploadOperationPhotos - Starting storage upload to bucket: opertion_photos")
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('opertion_photos')
          .upload(filePath, blob, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error('[v0] Error uploading photo:', uploadError)
          continue
        }
        console.log("[v0] uploadOperationPhotos - Storage upload successful:", uploadData)

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('opertion_photos')
          .getPublicUrl(filePath)
        console.log("[v0] uploadOperationPhotos - Public URL generated:", urlData.publicUrl)

        // Insert record into operation_photos table (server-side bypasses RLS)
        console.log("[v0] uploadOperationPhotos - Inserting into operation_photos table")
        const { error: dbError } = await supabase.from('operation_photos').insert({
          operation_id: operationId,
          storage_path: filePath,
          file_url: urlData.publicUrl,
        })

        if (dbError) {
          console.error('[v0] Error inserting photo record:', dbError)
          // Try to clean up the uploaded file
          await supabase.storage.from('opertion_photos').remove([filePath])
          continue
        }
        console.log("[v0] uploadOperationPhotos - Database insert successful")

        uploadedPhotos.push(urlData.publicUrl)
      } catch (error) {
        console.error('[v0] Failed to process photo:', error)
        continue
      }
    }

    return {
      success: true,
      uploadedCount: uploadedPhotos.length,
      photos: uploadedPhotos,
    }
  } catch (error) {
    console.error('[v0] Upload operation photos error:', error)
    return {
      success: false,
      uploadedCount: 0,
      photos: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
