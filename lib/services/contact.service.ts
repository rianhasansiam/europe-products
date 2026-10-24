import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AdminMessageQueryInput,
  ContactMessageInput,
  UpdateMessageStatusInput,
} from "@/lib/validations/contact.validation";

/**
 * Single home for ContactMessage DB logic.
 *
 * Reads are wrapped in `unstable_cache` and tagged "admin-messages" so
 * the admin Messages page can be served from the Next.js data cache.
 * Writes call `revalidateTag("admin-messages", "max")` from the route
 * handler so the next admin page visit pulls a fresh snapshot.
 */

export class ContactError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "ContactError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Public writes                                                             */
/* -------------------------------------------------------------------------- */

export async function createContactMessage(input: ContactMessageInput) {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      subject: input.subject,
      message: input.message,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Admin reads                                                               */
/* -------------------------------------------------------------------------- */

function buildAdminWhere(
  query: AdminMessageQueryInput,
): Prisma.ContactMessageWhereInput {
  const where: Prisma.ContactMessageWhereInput = {};

  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
      { subject: { contains: query.search, mode: "insensitive" } },
      { message: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listMessagesForAdmin(query: AdminMessageQueryInput) {
  const where = buildAdminWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total, newCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  return {
    items: rows,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      newCount,
    },
  };
}

/**
 * Cache layer over `listMessagesForAdmin`. Tagged "admin-messages" so
 * a new submission, status change, or delete can bust it on demand via
 * `revalidateTag("admin-messages", "max")`.
 */
const getCachedMessagesForAdmin = unstable_cache(
  async (query: AdminMessageQueryInput) => listMessagesForAdmin(query),
  ["admin-messages-list"],
  { revalidate: 300, tags: ["admin-messages"] },
);

export function listMessagesForAdminCached(query: AdminMessageQueryInput) {
  return getCachedMessagesForAdmin(query);
}

/* -------------------------------------------------------------------------- */
/*  Admin updates                                                             */
/* -------------------------------------------------------------------------- */

export async function updateMessageStatus(
  messageId: string,
  input: UpdateMessageStatusInput,
) {
  const existing = await prisma.contactMessage.findUnique({
    where: { id: messageId },
    select: { id: true, status: true },
  });
  if (!existing) throw new ContactError(404, "Message not found.");

  if (existing.status === input.status) {
    throw new ContactError(409, `Message is already ${input.status}.`);
  }

  return prisma.contactMessage.update({
    where: { id: messageId },
    data: { status: input.status },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteMessage(messageId: string) {
  try {
    await prisma.contactMessage.delete({ where: { id: messageId } });
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ContactError(404, "Message not found.");
    }
    throw error;
  }
}
