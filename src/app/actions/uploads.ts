"use server";
import { getActionAdmin, getActionUser } from "@/lib/auth";
import { createSignedUpload, validateUpload, type BucketKey } from "@/lib/storage";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";

type UploadTicket = { ok: true; path: string; token: string; bucket: BucketKey } | { ok: false; error: string };

/**
 * Issue a signed upload URL. Students may upload to their own folder in payment-proofs /
 * assignment-files and their avatar folder; only admins may upload course resources and branding.
 */
export async function requestUpload(input: { bucket: BucketKey; type: string; size: number; purpose?: "avatar" | "course" | "branding"; locale?: string }): Promise<UploadTicket> {
  const dict = getDictionary(isLocale(input.locale) ? input.locale : "nl");
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const invalid = validateUpload(input.bucket, input.type, input.size);
  if (invalid) return { ok: false, error: dict.errors[invalid] };
  if (input.purpose === "avatar" && input.size > 2 * 1024 * 1024) return { ok: false, error: dict.errors.fileTooLarge };

  let prefix: string;
  if (input.bucket === "payment-proofs" || input.bucket === "assignment-files") {
    prefix = current.user.id;
  } else if (input.bucket === "public-assets" && input.purpose === "avatar") {
    if (input.type === "image/svg+xml") return { ok: false, error: dict.errors.fileType };
    prefix = `avatars/${current.user.id}`;
  } else {
    const admin = await getActionAdmin();
    if (!admin) return { ok: false, error: dict.errors.notAuthorized };
    prefix = input.bucket === "course-resources" ? "resources" : input.purpose === "course" ? "courses" : "branding";
  }
  try {
    const { path, token } = await createSignedUpload(input.bucket, prefix, input.type);
    return { ok: true, path, token, bucket: input.bucket };
  } catch {
    return { ok: false, error: dict.errors.uploadFailed };
  }
}
