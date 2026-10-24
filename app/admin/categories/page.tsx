"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAdminCategories,
  setAdminCategoriesError,
  setAdminCategoriesLoading,
} from "@/store/slices/admin-categories.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  buildCategoryTree,
  buildFormFromCategory,
  createCategory,
  deleteCategory,
  EMPTY_FORM,
  fetchAllAdminCategoriesSnapshot,
  getDescendantIds,
  reorderCategories,
  updateCategory,
  type AdminCategoryRow,
  type CategoryFormState,
  type CategoryStatus,
} from "@/features/admin-categories/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";

import CategorySummaryCards from "./components/CategorySummaryCards";
import CategoriesToolbar from "./components/CategoriesToolbar";
import CategoriesTable, {
  type CategoryTreeTableRow,
} from "./components/CategoriesTable";
import CategoryFormDrawer from "./components/CategoryFormDrawer";

type StatusFilter = "ALL" | CategoryStatus;

export default function AdminCategoriesPage() {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesPage");
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector((state: RootState) => state.adminCategories.items);
  const isLoading = useSelector((state: RootState) => state.adminCategories.isLoading);
  const isHydrated = useSelector((state: RootState) => state.adminCategories.isHydrated);
  const error = useSelector((state: RootState) => state.adminCategories.error);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<AdminCategoryRow | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const refreshCategories = useCallback(async () => {
    dispatch(setAdminCategoriesLoading(true));
    dispatch(setAdminCategoriesError(null));
    try {
      const items = await fetchAllAdminCategoriesSnapshot();
      dispatch(setAdminCategories(items));
      setExpandedIds((current) => {
        if (current.size > 0) return current;
        return new Set(items.filter((item) => item.parentId === null).map((item) => item.id));
      });
    } catch (loadError) {
      dispatch(
        setAdminCategoriesError(
          loadError instanceof Error ? loadError.message : "Failed to load categories.",
        ),
      );
    } finally {
      dispatch(setAdminCategoriesLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    const timer = window.setTimeout(() => void refreshCategories(), 0);
    return () => window.clearTimeout(timer);
  }, [isHydrated, refreshCategories]);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const visibleRows = useMemo<CategoryTreeTableRow[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const hasFilter = normalizedQuery.length > 0 || statusFilter !== "ALL";
    const included = new Set<string>();
    const parentById = new Map(categories.map((item) => [item.id, item.parentId]));

    if (hasFilter) {
      for (const category of categories) {
        const matchesQuery =
          !normalizedQuery ||
          category.name.toLowerCase().includes(normalizedQuery) ||
          category.path.toLowerCase().includes(normalizedQuery) ||
          (category.description ?? "").toLowerCase().includes(normalizedQuery) ||
          (category.seoTitle ?? "").toLowerCase().includes(normalizedQuery) ||
          (category.metaDescription ?? "").toLowerCase().includes(normalizedQuery);
        const matchesStatus = statusFilter === "ALL" || category.status === statusFilter;
        if (!matchesQuery || !matchesStatus) continue;
        included.add(category.id);
        let parentId = category.parentId;
        while (parentId) {
          included.add(parentId);
          parentId = parentById.get(parentId) ?? null;
        }
      }
    }

    const rows: CategoryTreeTableRow[] = [];
    const walk = (nodes: typeof tree) => {
      for (const node of nodes) {
        if (hasFilter && !included.has(node.id)) continue;
        const expanded = hasFilter || expandedIds.has(node.id);
        rows.push({ category: node, hasChildren: node.children.length > 0, isExpanded: expanded });
        if (expanded) walk(node.children);
      }
    };
    walk(tree);
    return rows;
  }, [categories, expandedIds, query, statusFilter, tree]);

  const totals = useMemo(() => {
    const roots = categories.filter((item) => item.parentId === null).length;
    const subcategories = categories.length - roots;
    const active = categories.filter((item) => item.effectiveActive).length;
    const products = categories
      .filter((item) => item.parentId === null)
      .reduce((sum, item) => sum + item.totalProductCount, 0);
    return { roots, subcategories, active, products };
  }, [categories]);

  const openCreatePanel = (parent: AdminCategoryRow | null = null) => {
    const siblingCount = categories.filter(
      (item) => item.parentId === (parent?.id ?? null),
    ).length;
    setPanelMode("create");
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: parent?.id ?? "", position: String(siblingCount) });
    setMutationError(null);
    setPanelOpen(true);
  };

  const openEditPanel = (category: AdminCategoryRow) => {
    setPanelMode("edit");
    setEditing(category);
    setForm(buildFormFromCategory(category));
    setMutationError(null);
    setPanelOpen(true);
  };

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setMutationError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(null);
    setSuccessNote(null);
    const name = form.name.trim();
    if (name.length < 2) {
      setMutationError("Category name must be at least 2 characters.");
      return;
    }
    const parsedPosition = Number(form.position);
    if (!Number.isInteger(parsedPosition) || parsedPosition < 0) {
      setMutationError("Position must be a non-negative whole number.");
      return;
    }

    const body = {
      name,
      description: form.description.trim() || null,
      image: form.image.trim() || null,
      seoTitle: form.seoTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
      ogImage: form.ogImage.trim() || null,
      status: form.status,
      parentId: form.parentId || null,
      position: parsedPosition,
    };

    setIsSubmitting(true);
    try {
      if (panelMode === "create") {
        await createCategory(body);
        notifyActionSuccess("Category created successfully.");
        setSuccessNote("Category created successfully.");
      } else {
        if (!editing) throw new Error(i18n("No category selected for editing."));
        const patch: Partial<typeof body> = {};
        if (body.name !== editing.name) patch.name = body.name;
        if (body.description !== editing.description) patch.description = body.description;
        if (body.image !== editing.image) patch.image = body.image;
        if (body.seoTitle !== editing.seoTitle) patch.seoTitle = body.seoTitle;
        if (body.metaDescription !== editing.metaDescription) {
          patch.metaDescription = body.metaDescription;
        }
        if (body.ogImage !== editing.ogImage) patch.ogImage = body.ogImage;
        if (body.status !== editing.status) patch.status = body.status;
        if (body.parentId !== editing.parentId) patch.parentId = body.parentId;
        if (body.position !== editing.position) patch.position = body.position;
        if (Object.keys(patch).length === 0) {
          setMutationError("No changes to save.");
          return;
        }
        await updateCategory(editing.id, patch);
        notifyActionSuccess("Category updated successfully.");
        setSuccessNote("Category updated successfully.");
      }
      closePanel();
      await refreshCategories();
    } catch (mutation) {
      const message = mutation instanceof Error ? mutation.message : "Category mutation failed.";
      setMutationError(message);
      notifyActionError(mutation, "Category mutation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVisibility = async (category: AdminCategoryRow) => {
    setBusyId(category.id);
    const status: CategoryStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateCategory(category.id, { status });
      await refreshCategories();
      const message =
        status === "ACTIVE"
          ? "Category activated. An inactive ancestor can still keep it hidden from the storefront."
          : "Category subtree hidden from the storefront.";
      setSuccessNote(message);
      notifyActionSuccess(message);
    } catch (mutation) {
      setMutationError(mutation instanceof Error ? mutation.message : "Failed to update visibility.");
      notifyActionError(mutation, "Failed to update visibility.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (category: AdminCategoryRow) => {
    if (category.childCount > 0 || category.directProductCount > 0) {
      const message = i18n("Only empty leaf categories can be deleted. Move or hide its children and products first.");
      setMutationError(message);
      notifyActionError(new Error(message), "Category cannot be deleted.");
      return;
    }
    const confirmed = await confirmMajorAction({
      title: `Delete "${category.name}"?`,
      description: i18n("This permanently deletes this empty category."),
      confirmLabel: "Delete category",
      variant: "danger",
    });
    if (!confirmed) return;

    setBusyId(category.id);
    try {
      await deleteCategory(category.id);
      await refreshCategories();
      setSuccessNote("Category deleted successfully.");
      notifyActionSuccess("Category deleted successfully.");
    } catch (mutation) {
      setMutationError(mutation instanceof Error ? mutation.message : "Failed to delete category.");
      notifyActionError(mutation, "Failed to delete category.");
    } finally {
      setBusyId(null);
    }
  };

  const moveCategory = async (category: AdminCategoryRow, direction: -1 | 1) => {
    const siblings = categories
      .filter((item) => item.parentId === category.parentId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const index = siblings.findIndex((item) => item.id === category.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const orderedIds = siblings.map((item) => item.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    setBusyId(category.id);
    try {
      await reorderCategories(category.parentId, orderedIds);
      await refreshCategories();
      notifyActionSuccess("Category order updated.");
    } catch (mutation) {
      setMutationError(mutation instanceof Error ? mutation.message : "Failed to reorder categories.");
      notifyActionError(mutation, "Failed to reorder categories.");
    } finally {
      setBusyId(null);
    }
  };

  const invalidParentIds = editing
    ? new Set([editing.id, ...getDescendantIds(categories, editing.id)])
    : new Set<string>();

  return (
    <section className="space-y-4">
      <CategorySummaryCards
        roots={totals.roots}
        subcategories={totals.subcategories}
        active={totals.active}
        productsMapped={totals.products}
      />
      <CategoriesToolbar
        query={query}
        statusFilter={statusFilter}
        visibleCount={visibleRows.length}
        totalCount={categories.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        onRefresh={() => void refreshCategories()}
        onCreate={() => openCreatePanel()}
        onExpandAll={() => setExpandedIds(new Set(categories.map((item) => item.id)))}
        onCollapseAll={() => setExpandedIds(new Set())}
      />

      {error && <Notice tone="error">{i18n(error)}</Notice>}
      {mutationError && <Notice tone="error">{mutationError}</Notice>}
      {successNote && <Notice tone="success">{successNote}</Notice>}

      <CategoriesTable
        rows={visibleRows}
        isLoading={isLoading}
        totalCount={categories.length}
        busyId={busyId}
        onToggleExpanded={(id) =>
          setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onAddChild={(category) => openCreatePanel(category)}
        onEdit={openEditPanel}
        onMoveUp={(category) => void moveCategory(category, -1)}
        onMoveDown={(category) => void moveCategory(category, 1)}
        onToggleVisibility={(category) => void handleToggleVisibility(category)}
        onDelete={(category) => void handleDelete(category)}
      />

      <CategoryFormDrawer
        open={panelOpen}
        mode={panelMode}
        editing={editing}
        categories={categories}
        invalidParentIds={invalidParentIds}
        form={form}
        isSubmitting={isSubmitting}
        onClose={closePanel}
        onChange={setForm}
        onSubmit={handleSubmit}
      />
    </section>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
      }
    >
      {children}
    </div>
  );
}
