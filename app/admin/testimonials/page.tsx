"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  removeAdminTestimonial,
  setAdminTestimonials,
  setAdminTestimonialsError,
  setAdminTestimonialsLoading,
  upsertAdminTestimonial,
} from "@/store/slices/admin-testimonials.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  buildFormFromTestimonial,
  createTestimonial,
  deleteTestimonial,
  EMPTY_FORM,
  fetchAllAdminTestimonialsSnapshot,
  updateTestimonial,
  type AdminTestimonialRow,
  type TestimonialFormState,
  type TestimonialStatus,
} from "@/features/admin-testimonials/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import TestimonialSummaryCards from "./components/TestimonialSummaryCards";
import TestimonialsToolbar from "./components/TestimonialsToolbar";
import TestimonialsTable from "./components/TestimonialsTable";
import TestimonialForm from "./components/TestimonialForm";
import ImportReviewsPanel from "./components/ImportReviewsPanel";

type StatusFilter = "ALL" | TestimonialStatus;

export default function AdminTestimonialsPage() {
  const i18n = useInterfaceTranslations("AdminAdminTestimonialsPage");
  const dispatch = useDispatch<AppDispatch>();
  const testimonials = useSelector(
    (state: RootState) => state.adminTestimonials.items,
  );
  const isLoading = useSelector(
    (state: RootState) => state.adminTestimonials.isLoading,
  );
  const isHydrated = useSelector(
    (state: RootState) => state.adminTestimonials.isHydrated,
  );
  const error = useSelector((state: RootState) => state.adminTestimonials.error);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Form panel state: null = closed, "new" = create, else editing that id.
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TestimonialFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Import-from-reviews panel.
  const [showImport, setShowImport] = useState(false);
  const {
    visibleItems: animatedTestimonials,
    queueRemoval: queueTestimonialRemoval,
  } = useAnimatedRemoval({
    items: testimonials,
    getId: (testimonial) => testimonial.id,
  });

  const refresh = useCallback(async () => {
    dispatch(setAdminTestimonialsLoading(true));
    dispatch(setAdminTestimonialsError(null));
    try {
      const items = await fetchAllAdminTestimonialsSnapshot();
      dispatch(setAdminTestimonials(items));
    } catch (loadError) {
      dispatch(
        setAdminTestimonialsError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load testimonials.",
        ),
      );
    } finally {
      dispatch(setAdminTestimonialsLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    void refresh();
  }, [isHydrated, refresh]);

  const activeCount = useMemo(
    () => testimonials.filter((t) => t.status === "ACTIVE").length,
    [testimonials],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return animatedTestimonials.filter((t) => {
      const matchQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.location ?? "").toLowerCase().includes(q) ||
        t.text.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [animatedTestimonials, query, statusFilter]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, position: testimonials.length });
    setEditingId("new");
    setMutationError(null);
    setSuccessNote(null);
  };

  const openEdit = (row: AdminTestimonialRow) => {
    setForm(buildFormFromTestimonial(row));
    setEditingId(row.id);
    setMutationError(null);
    setSuccessNote(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMutationError(null);

    if (form.name.trim().length < 2) {
      setMutationError("Please enter the reviewer's name.");
      return;
    }
    if (form.text.trim().length < 10) {
      setMutationError("Testimonial text should be at least 10 characters.");
      return;
    }

    const body = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      image: form.image.trim() || null,
      rating: form.rating,
      text: form.text.trim(),
      position: form.position,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId === "new") {
        const created = await createTestimonial(body);
        dispatch(upsertAdminTestimonial(created));
        const message = i18n("Testimonial added.");
        setSuccessNote(message);
        notifyActionSuccess(message);
      } else if (editingId) {
        const updated = await updateTestimonial(editingId, body);
        dispatch(upsertAdminTestimonial(updated));
        const message = i18n("Testimonial updated.");
        setSuccessNote(message);
        notifyActionSuccess(message);
      }
      closeForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save the testimonial.";
      setMutationError(message);
      notifyActionError(saveError, "Failed to save the testimonial.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this testimonial?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    queueTestimonialRemoval(
      id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(id);
        try {
          await deleteTestimonial(id);
          dispatch(removeAdminTestimonial(id));
          if (editingId === id) closeForm();
          setSuccessNote("Testimonial deleted.");
          notifyActionSuccess("Testimonial deleted.");
        } catch (deleteError) {
          const message =
            deleteError instanceof Error
              ? deleteError.message
              : "Failed to delete the testimonial.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Failed to delete the testimonial.");
      },
    );
  };

  return (
    <section className="space-y-4">
      <TestimonialSummaryCards
        total={testimonials.length}
        activeCount={activeCount}
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
        {i18n("The About page shows your")}{" "}<strong>{i18n("active")}</strong> {i18n("testimonials. With 3 or fewer it renders a static grid; with more than 3 it switches to a smooth left-to-right auto-scrolling marquee.")}</div>

      <TestimonialsToolbar
        query={query}
        statusFilter={statusFilter}
        visibleCount={visible.length}
        totalCount={testimonials.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        onToggleImport={() => {
          setShowImport((open) => !open);
          setMutationError(null);
          setSuccessNote(null);
        }}
        onCreate={openCreate}
        onRefresh={() => {
          void refresh();
        }}
      />

      {showImport && (
        <ImportReviewsPanel
          existing={testimonials}
          onClose={() => setShowImport(false)}
          onImported={(row) => {
            dispatch(upsertAdminTestimonial(row));
            const message = `Imported a review from ${row.name}.`;
            setSuccessNote(message);
            notifyActionSuccess(message);
          }}
          onError={(message) => {
            setMutationError(message);
            notifyActionError(message, "Failed to import the review.");
          }}
        />
      )}

      {editingId && (
        <TestimonialForm
          mode={editingId === "new" ? "create" : "edit"}
          form={form}
          setForm={setForm}
          saving={saving}
          onCancel={closeForm}
          onSubmit={handleSave}
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {i18n(error)}
        </div>
      )}
      {mutationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}
      {successNote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successNote}
        </div>
      )}

      <TestimonialsTable
        testimonials={visible}
        isLoading={isLoading}
        totalCount={testimonials.length}
        busyId={busyId}
        onEdit={openEdit}
        onDelete={(id) => {
          void handleDelete(id);
        }}
      />
    </section>
  );
}
