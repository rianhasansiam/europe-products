import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), user: vi.fn(), requireConfig: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, user: { findUnique: mocks.user } } }));
vi.mock("@/lib/airwallex/config/airwallex.config", () => ({ requireAirwallexConfig: mocks.requireConfig }));
import { placeOrderForCustomer } from "@/lib/services/checkout.service";
import { adminCheckoutSchema } from "@/lib/validations/checkout.validation";

const input = {
  items: [{ productId: "p1", quantity: 1 }], customerName: "Customer", customerPhone: "+8801700000000",
  customerAddress: "Customer delivery address", deliveryZone: "INSIDE_DHAKA" as const,
  paymentMethod: "AIRWALLEX" as const, clearCart: false,
};

describe("staff Airwallex orders", () => {
  it("rejects unpayable staff guest orders before inventory or promotion reservation", async () => {
    await expect(placeOrderForCustomer(null, input)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("public checkout") });
    expect(mocks.requireConfig).not.toHaveBeenCalled();
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires a registered owner at the API validation boundary", () => {
    expect(adminCheckoutSchema.safeParse(input).success).toBe(false);
    expect(adminCheckoutSchema.safeParse({ ...input, customerId: "owner" }).success).toBe(true);
  });
});
