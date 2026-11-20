import { z } from "zod";
import { countryCodes } from "@/lib/countries";

export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "weak");

export const registerSchema = z
  .object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.email().max(200).transform((s) => s.toLowerCase()),
    phone: z.string().trim().min(5).max(40).regex(/^[+\d\s()-]+$/),
    country: z.string().refine((c) => countryCodes.includes(c)),
    preferred_locale: z.enum(["nl", "en"]),
    password: passwordSchema,
    password_confirm: z.string(),
    terms: z.literal("on"),
  })
  .refine((v) => v.password === v.password_confirm, { path: ["password_confirm"], message: "mismatch" });

export const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(40).regex(/^[+\d\s()-]+$/),
  country: z.string().refine((c) => countryCodes.includes(c)),
  preferred_locale: z.enum(["nl", "en"]),
});

/** Only allow same-site relative redirects. */
export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export const uuidSchema = z.uuid();
