import { z } from "zod";

/**
 * Zod schemas for the public contact form and the admin Messages page.
 *
 * Mirrors the Prisma `ContactMessageStatus` enum so a rename here is a
 * TS error.
 */

const STATUS = ["NEW", "READ", "ARCHIVED"] as const;

/** Limits chosen to be generous but safe — no abuse vectors via huge bodies. */
const NAME_MIN = 2;
const NAME_MAX = 120;
const EMAIL_MAX = 254;
const PHONE_MIN = 6;
const PHONE_MAX = 30;
const SUBJECT_MIN = 2;
const SUBJECT_MAX = 120;
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 4000;

/** Body for `POST /api/contact` (public). */
export const contactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, "Please enter your full name.")
    .max(NAME_MAX, "Name is too long."),
  email: z
    .email("Please enter a valid email address.")
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX, "Email is too long."),
  phone: z
    .string()
    .trim()
    .min(PHONE_MIN, "Please enter a valid phone number.")
    .max(PHONE_MAX, "Phone number is too long.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  subject: z
    .string()
    .trim()
    .min(SUBJECT_MIN, "Please choose a subject.")
    .max(SUBJECT_MAX, "Subject is too long."),
  message: z
    .string()
    .trim()
    .min(MESSAGE_MIN, "Please describe how we can help.")
    .max(MESSAGE_MAX, "Message is too long."),
});

/** Query string for `GET /api/admin/messages`. */
export const adminMessageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(STATUS).optional(),
});

/** Body for `PATCH /api/admin/messages/[id]`. */
export const updateMessageStatusSchema = z.object({
  status: z.enum(STATUS),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
export type AdminMessageQueryInput = z.infer<typeof adminMessageQuerySchema>;
export type UpdateMessageStatusInput = z.infer<typeof updateMessageStatusSchema>;
