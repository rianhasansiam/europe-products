"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { Factory, Tags } from "lucide-react";

import {
  buildCatalogEntityForm,
  createCatalogEntity,
  deleteCatalogEntity,
  EMPTY_CATALOG_ENTITY_FORM,
  fetchAllCatalogEntities,
  updateCatalogEntity,
  type AdminCatalogEntityRow,
  type CatalogEntityFormState,
  type CatalogEntityKind,
  type CatalogEntityStatus,
  type CatalogEntityWriteBody,
} from "@/features/admin-catalog-entities/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";

import CatalogEntityFormDrawer from "./CatalogEntityFormDrawer";
import CatalogEntitySummaryCards from "./CatalogEntitySummaryCards";
import CatalogEntityTable from "./CatalogEntityTable";
import CatalogEntityToolbar from "./CatalogEntityToolbar";

type StatusFilter = "ALL" | CatalogEntityStatus;

function isValidWebsite(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function CatalogEntityAdminPage({
  kind,
}: {
  kind: CatalogEntityKind;
}) {
  const i18n = useInterfaceTranslations("AdminAdminComponentsCatalogEntitiesCatalogEntityAdminPage");
  const isBrand = kind === "brand";
  const singularLabel = isBrand ? "Brand" : "Manufacturer";
  const pluralLabel = isBrand ? "brands" : "manufacturers";
  const Icon = isBrand ? Tags : Factory;

  const [rows, setRows] = useState<AdminCatalogEntityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationNote, setMutationNote] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCatalogEntityRow | "new" | null>(null);
  const [form, setForm] = useState<CatalogEntityFormState>({
    ...EMPTY_CATALOG_ENTITY_FORM,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchAllCatalogEntities(kind));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : `Failed to load ${pluralLabel}.`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [kind, pluralLabel]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const activeCount = useMemo(
    () => rows.filter((row) => row.status === "ACTIVE").length,
    [rows],
  );
  const productsMapped = useMemo(
    () => rows.reduce((sum, row) => sum + row.productCount, 0),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "ALL" || row.status === statusFilter;
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search) ||
        row.slug.toLowerCase().includes(search) ||
        (row.description ?? "").toLowerCase().includes(search) ||
        (row.seoTitle ?? "").toLowerCase().includes(search) ||
        (row.metaDescription ?? "").toLowerCase().includes(search) ||
        (row.website ?? "").toLowerCase().includes(search) ||
        (row.country ?? "").toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [query, rows, statusFilter]);

  const closeForm = () => {
    if (isSubmitting) return;
    setEditing(null);
    setForm({ ...EMPTY_CATALOG_ENTITY_FORM });
  };

  const openCreate = () => {
    setEditing("new");
    setForm({ ...EMPTY_CATALOG_ENTITY_FORM });
    setMutationNote(null);
  };

  const openEdit = (row: AdminCatalogEntityRow) => {
    setEditing(row);
    setForm(buildCatalogEntityForm(row));
    setMutationNote(null);
  };

  const upsertRow = (row: AdminCatalogEntityRow) => {
    setRows((current) =>
      [...current.filter((item) => item.id !== row.id), row].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationNote(null);

    if (form.name.trim().length < 2) {
      setMutationNote({
        tone: "error",
        message: `${singularLabel} name must contain at least 2 characters.`,
      });
      return;
    }
    if (!isValidWebsite(form.website)) {
      setMutationNote({
        tone: "error",
        message: i18n("Enter a valid http:// or https:// website."),
      });
      return;
    }
    if (
      isBrand &&
      editing !== "new" &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())
    ) {
      setMutationNote({
        tone: "error",
        message: i18n("Use a lowercase slug with letters, numbers, and single hyphens."),
      });
      return;
    }

    const body: CatalogEntityWriteBody = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      logo: form.logo.trim() || null,
      website: form.website.trim() || null,
      status: form.status,
      ...(isBrand
        ? {
            ...(editing !== "new" ? { slug: form.slug.trim() } : {}),
            seoTitle: form.seoTitle.trim() || null,
            metaDescription: form.metaDescription.trim() || null,
            ogImage: form.ogImage.trim() || null,
          }
        : {}),
      ...(kind === "manufacturer"
        ? { country: form.country.trim() || null }
        : {}),
    };

    setIsSubmitting(true);
    try {
      const saved =
        editing === "new"
          ? await createCatalogEntity(kind, body)
          : editing
            ? await updateCatalogEntity(kind, editing.id, body)
            : null;
      if (!saved) return;

      upsertRow(saved);
      const message = `${singularLabel} ${editing === "new" ? "created" : "updated"}.`;
      setMutationNote({ tone: "success", message });
      notifyActionSuccess(message);
      setEditing(null);
      setForm({ ...EMPTY_CATALOG_ENTITY_FORM });
    } catch (error) {
      const message = notifyActionError(
        error,
        `Failed to save ${singularLabel.toLowerCase()}.`,
      );
      setMutationNote({ tone: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (row: AdminCatalogEntityRow) => {
    setBusyId(row.id);
    setMutationNote(null);
    const status: CatalogEntityStatus =
      row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const updated = await updateCatalogEntity(kind, row.id, { status });
      upsertRow(updated);
      const message = `${singularLabel} ${status === "ACTIVE" ? "activated" : "hidden"}.`;
      setMutationNote({ tone: "success", message });
      notifyActionSuccess(message);
    } catch (error) {
      const message = notifyActionError(
        error,
        `Failed to update ${singularLabel.toLowerCase()} visibility.`,
      );
      setMutationNote({ tone: "error", message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: AdminCatalogEntityRow) => {
    if (row.productCount > 0) {
      const message = `Reassign ${row.productCount} linked product${row.productCount === 1 ? "" : "s"} before deleting this ${singularLabel.toLowerCase()}.`;
      setMutationNote({ tone: "error", message });
      notifyActionError(message, message);
      return;
    }

    const confirmed = await confirmMajorAction({
      title: `Delete ${row.name}?`,
      description: `This permanently removes the ${singularLabel.toLowerCase()} and cannot be undone.`,
      confirmLabel: `Delete ${singularLabel}`,
      variant: "danger",
    });
    if (!confirmed) return;

    setBusyId(row.id);
    setMutationNote(null);
    try {
      await deleteCatalogEntity(kind, row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      if (editing !== "new" && editing?.id === row.id) closeForm();
      const message = `${singularLabel} deleted.`;
      setMutationNote({ tone: "success", message });
      notifyActionSuccess(message);
    } catch (error) {
      const message = notifyActionError(
        error,
        `Failed to delete ${singularLabel.toLowerCase()}.`,
      );
      setMutationNote({ tone: "error", message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-black px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
              {i18n("Catalog")}</p>
            <h1 className="text-xl font-black sm:text-2xl">{i18n(isBrand ? "Brands" : "Manufacturers")}</h1>
            <p className="mt-0.5 text-xs text-white/70 sm:text-sm">
              {i18n("Manage reusable product")}{" "}{pluralLabel} {i18n("and storefront visibility.")}</p>
          </div>
        </div>
      </div>

      <CatalogEntitySummaryCards
        pluralLabel={pluralLabel}
        total={rows.length}
        active={activeCount}
        productsMapped={productsMapped}
      />

      <CatalogEntityToolbar
        singularLabel={singularLabel}
        pluralLabel={pluralLabel}
        query={query}
        statusFilter={statusFilter}
        visibleCount={visibleRows.length}
        totalCount={rows.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        onRefresh={() => void refresh()}
        onCreate={openCreate}
      />

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {mutationNote && (
        <div
          role={mutationNote.tone === "error" ? "alert" : "status"}
          className={
            mutationNote.tone === "error"
              ? "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          }
        >
          {mutationNote.message}
        </div>
      )}

      <CatalogEntityTable
        kind={kind}
        rows={visibleRows}
        isLoading={isLoading}
        totalCount={rows.length}
        busyId={busyId}
        onEdit={openEdit}
        onToggle={(row) => void handleToggle(row)}
        onDelete={(row) => void handleDelete(row)}
      />

      <CatalogEntityFormDrawer
        kind={kind}
        open={editing !== null}
        mode={editing === "new" ? "create" : "edit"}
        editing={editing === "new" ? null : editing}
        form={form}
        isSubmitting={isSubmitting}
        onClose={closeForm}
        onChange={setForm}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
