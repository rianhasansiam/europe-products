import { z } from "zod";

/**
 * Zod schema for the courier fraud-check API.
 *
 * The only input is a Bangladeshi mobile number. We normalise it to
 * the canonical 11-digit `01XXXXXXXXX` form in the service, but accept
 * a little slack here (spaces, dashes, a leading +88/88) so the admin
 * can paste a number straight off an order without reformatting.
 */

const phoneNumber = z
  .string()
  .trim()
  .min(7, "Phone number is too short.")
  .max(20, "Phone number is too long.");

/** Body for `POST /api/admin/courier`. */
export const courierCheckSchema = z.object({
  phone: phoneNumber,
});

export type CourierCheckInput = z.infer<typeof courierCheckSchema>;
