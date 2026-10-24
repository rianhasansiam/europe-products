import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

import {
  cleanOptionalText,
  slugifyCatalogName,
} from "@/lib/catalog/catalog-entity";
import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  CreateManufacturerInput,
  ManufacturerQueryInput,
  UpdateManufacturerInput,
} from "@/lib/validations/manufacturer.validation";

const manufacturerSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  website: true,
  country: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.ManufacturerSelect;

type ManufacturerRow = Prisma.ManufacturerGetPayload<{
  select: typeof manufacturerSelect;
}>;

export type SerializedManufacturer = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  country: string | null;
  status: "ACTIVE" | "INACTIVE";
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

function serializeManufacturer(
  row: ManufacturerRow,
): SerializedManufacturer {
  const { _count, ...manufacturer } = row;
  return {
    ...manufacturer,
    productCount: _count.products,
    createdAt: manufacturer.createdAt.toISOString(),
    updatedAt: manufacturer.updatedAt.toISOString(),
  };
}

function buildWhere(
  query: ManufacturerQueryInput,
): Prisma.ManufacturerWhereInput {
  const where: Prisma.ManufacturerWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { country: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { website: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function buildOrderBy(
  sort: ManufacturerQueryInput["sort"],
): Prisma.ManufacturerOrderByWithRelationInput[] {
  switch (sort) {
    case "latest":
      return [{ createdAt: "desc" }, { name: "asc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { name: "asc" }];
    case "name":
    default:
      return [{ name: "asc" }, { createdAt: "asc" }];
  }
}

export async function listManufacturers(query: ManufacturerQueryInput) {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    prisma.manufacturer.findMany({
      where,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.pageSize,
      select: manufacturerSelect,
    }),
    prisma.manufacturer.count({ where }),
  ]);

  return {
    items: rows.map(serializeManufacturer),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getManufacturerById(
  id: string,
): Promise<SerializedManufacturer | null> {
  const row = await prisma.manufacturer.findUnique({
    where: { id },
    select: manufacturerSelect,
  });
  return row ? serializeManufacturer(row) : null;
}

async function assertUniqueManufacturerName(name: string, excludeId?: string) {
  const conflict = await prisma.manufacturer.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new ServiceError(
      409,
      "A manufacturer with that name already exists.",
    );
  }
}

async function generateUniqueManufacturerSlug(name: string): Promise<string> {
  const root = slugifyCatalogName(name, "manufacturer");
  let candidate = root;

  for (let suffix = 2; suffix <= 51; suffix += 1) {
    const conflict = await prisma.manufacturer.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!conflict) return candidate;
    candidate = `${root}-${suffix}`;
  }

  return `${root}-${Date.now()}`;
}

function mapManufacturerWriteError(error: unknown): never {
  if (error instanceof ServiceError) throw error;
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new ServiceError(404, "Manufacturer not found.");
    }
    if (error.code === "P2002") {
      throw new ServiceError(
        409,
        "A manufacturer with that name already exists.",
      );
    }
  }
  throw error;
}

export async function createManufacturer(input: CreateManufacturerInput) {
  await assertUniqueManufacturerName(input.name);
  const slug = await generateUniqueManufacturerSlug(input.name);

  try {
    const row = await prisma.manufacturer.create({
      data: {
        name: input.name,
        slug,
        description: cleanOptionalText(input.description) ?? null,
        logo: cleanOptionalText(input.logo) ?? null,
        website: cleanOptionalText(input.website) ?? null,
        country: cleanOptionalText(input.country) ?? null,
        status: input.status,
      },
      select: manufacturerSelect,
    });
    return serializeManufacturer(row);
  } catch (error) {
    return mapManufacturerWriteError(error);
  }
}

export async function updateManufacturer(
  id: string,
  input: UpdateManufacturerInput,
) {
  if (input.name !== undefined) {
    await assertUniqueManufacturerName(input.name, id);
  }

  const data: Prisma.ManufacturerUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) {
    data.description = cleanOptionalText(input.description);
  }
  if (input.logo !== undefined) data.logo = cleanOptionalText(input.logo);
  if (input.website !== undefined) {
    data.website = cleanOptionalText(input.website);
  }
  if (input.country !== undefined) {
    data.country = cleanOptionalText(input.country);
  }
  if (input.status !== undefined) data.status = input.status;

  try {
    const row = await prisma.manufacturer.update({
      where: { id },
      data,
      select: manufacturerSelect,
    });
    return serializeManufacturer(row);
  } catch (error) {
    return mapManufacturerWriteError(error);
  }
}

export async function deleteManufacturer(
  id: string,
): Promise<{ id: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.manufacturer.findUnique({
        where: { id },
        select: { id: true, _count: { select: { products: true } } },
      });
      if (!existing) {
        throw new ServiceError(404, "Manufacturer not found.");
      }
      if (existing._count.products > 0) {
        throw new ServiceError(
          409,
          `Cannot delete this manufacturer while ${existing._count.products} product${existing._count.products === 1 ? "" : "s"} reference it.`,
          { productCount: existing._count.products },
        );
      }

      await tx.manufacturer.delete({ where: { id } });
      return { id };
    });
  } catch (error) {
    return mapManufacturerWriteError(error);
  }
}
