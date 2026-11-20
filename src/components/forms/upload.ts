"use client";
import { createClient } from "@/lib/supabase/client";
import { requestUpload } from "@/app/actions/uploads";
import type { BucketKey } from "@/lib/storage-types";

export type UploadedFile = { storage_path: string; file_name: string; mime_type: string; file_size: number };

/** Upload a file directly to Supabase Storage via a server-issued signed URL. */
export async function uploadFile(file: File, bucket: BucketKey, locale: string, purpose?: "avatar" | "course" | "branding"): Promise<UploadedFile> {
  const ticket = await requestUpload({ bucket, type: file.type, size: file.size, purpose, locale });
  if (!ticket.ok) throw new Error(ticket.error);
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return { storage_path: ticket.path, file_name: file.name.slice(0, 200), mime_type: file.type, file_size: file.size };
}
