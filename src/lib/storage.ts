import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type { BucketKey } from "@/lib/storage-types";
import type { BucketKey } from "@/lib/storage-types";

export const bucketRules: Record<BucketKey, { maxBytes: number; types: string[] }> = {
  "payment-proofs": { maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/png", "image/jpeg", "image/webp"] },
  "assignment-files": {
    maxBytes: 20 * 1024 * 1024,
    types: [
      "application/pdf", "application/zip", "image/png", "image/jpeg", "image/webp", "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  "course-resources": {
    maxBytes: 50 * 1024 * 1024,
    types: [
      "application/pdf", "application/zip", "image/png", "image/jpeg", "text/plain", "text/csv", "video/mp4",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  "public-assets": { maxBytes: 5 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
};

const extFor: Record<string, string> = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg",
  "application/zip": "zip", "text/plain": "txt", "text/csv": "csv", "video/mp4": "mp4",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function validateUpload(bucket: BucketKey, type: string, size: number): "fileType" | "fileTooLarge" | null {
  const rules = bucketRules[bucket];
  if (!rules.types.includes(type)) return "fileType";
  if (!Number.isFinite(size) || size <= 0 || size > rules.maxBytes) return "fileTooLarge";
  return null;
}

/** Create a one-time signed upload URL for `prefix/<uuid>.<ext>`. Caller must authorize first. */
export async function createSignedUpload(bucket: BucketKey, prefix: string, type: string) {
  const path = `${prefix.replace(/\/+$/, "")}/${randomUUID()}.${extFor[type] ?? "bin"}`;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "upload url failed");
  return { path, token: data.token };
}

/** Confirm an uploaded object exists and return its metadata. */
export async function getObjectInfo(bucket: BucketKey, path: string): Promise<{ size: number; mimetype: string } | null> {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await createAdminClient().storage.from(bucket).list(folder, { search: name, limit: 5 });
  if (error || !data) return null;
  const obj = data.find((o) => o.name === name);
  if (!obj) return null;
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: Number(meta.size ?? 0), mimetype: String(meta.mimetype ?? "") };
}

export async function signedDownloadUrl(bucket: BucketKey, path: string, seconds = 300, downloadName?: string) {
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

export function publicUrl(path: string) {
  return createAdminClient().storage.from("public-assets").getPublicUrl(path).data.publicUrl;
}
