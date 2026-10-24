import "server-only";

import { Prisma } from "@/app/generated/prisma/client";

import { jsonError } from "@/lib/api/response";
import { handleServiceError } from "@/lib/services/service-error";

export function handleCategoryApiError(scope: string, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return jsonError(404, "Category not found.");
    }
    if (error.code === "P2002") {
      return jsonError(409, "The category path already exists.");
    }
  }

  return handleServiceError(scope, error);
}
