"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  patchAdminMessage,
  removeAdminMessage,
  setAdminMessages,
  setAdminMessagesError,
  setAdminMessagesLoading,
} from "@/store/slices/admin-messages.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  deleteAdminMessage,
  fetchAllAdminMessagesSnapshot,
  patchMessageStatus,
  type AdminMessageRow,
  type ContactMessageStatus,
} from "@/features/admin-messages/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import MessageSummaryCards from "./components/MessageSummaryCards";
import MessagesToolbar from "./components/MessagesToolbar";
import MessagesTable from "./components/MessagesTable";
import MessageDrawer from "./components/MessageDrawer";

type StatusFilter = "ALL" | ContactMessageStatus;

export default function AdminMessagesPage() {
  const i18n = useInterfaceTranslations("AdminAdminMessagesPage");
  const dispatch = useDispatch<AppDispatch>();
  const messages = useSelector(
    (state: RootState) => state.adminMessages.items,
  );
  const isLoading = useSelector(
    (state: RootState) => state.adminMessages.isLoading,
  );
  const isHydrated = useSelector(
    (state: RootState) => state.adminMessages.isHydrated,
  );
  const error = useSelector((state: RootState) => state.adminMessages.error);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [openMessage, setOpenMessage] = useState<AdminMessageRow | null>(null);
  const { visibleItems: animatedMessages, queueRemoval: queueMessageRemoval } =
    useAnimatedRemoval({
      items: messages,
      getId: (message) => message.id,
    });

  const refreshMessages = useCallback(async () => {
    dispatch(setAdminMessagesLoading(true));
    dispatch(setAdminMessagesError(null));
    try {
      const items = await fetchAllAdminMessagesSnapshot();
      dispatch(setAdminMessages(items));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load messages.";
      dispatch(setAdminMessagesError(message));
    } finally {
      dispatch(setAdminMessagesLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    void refreshMessages();
  }, [isHydrated, refreshMessages]);

  const visibleMessages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return animatedMessages.filter((row) => {
      const matchQuery =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.phone ?? "").toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        row.message.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" || row.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [animatedMessages, query, statusFilter]);

  const totals = useMemo(() => {
    let newCount = 0;
    let readCount = 0;
    let archivedCount = 0;
    for (const row of messages) {
      if (row.status === "NEW") newCount += 1;
      else if (row.status === "READ") readCount += 1;
      else if (row.status === "ARCHIVED") archivedCount += 1;
    }
    return { newCount, readCount, archivedCount };
  }, [messages]);

  const handleSetStatus = async (
    row: AdminMessageRow,
    next: ContactMessageStatus,
    options?: { silent?: boolean },
  ) => {
    if (row.status === next) return;
    setMutationError(null);
    setBusyId(row.id);
    try {
      const updated = await patchMessageStatus(row.id, next);
      dispatch(
        patchAdminMessage({
          id: row.id,
          changes: {
            status: updated.status,
            updatedAt: updated.updatedAt,
          },
        }),
      );
      if (openMessage?.id === row.id) {
        setOpenMessage({ ...openMessage, status: updated.status });
      }
      if (!options?.silent) {
        notifyActionSuccess("Message status updated.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update message.";
      setMutationError(message);
      if (!options?.silent) {
        notifyActionError(err, "Failed to update message.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: AdminMessageRow) => {
    const confirmed = await confirmMajorAction({
      title: `Delete message from ${row.name || row.email}?`,
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    queueMessageRemoval(
      row.id,
      async () => {
        setMutationError(null);
        setBusyId(row.id);
        try {
          await deleteAdminMessage(row.id);
          dispatch(removeAdminMessage(row.id));
          if (openMessage?.id === row.id) setOpenMessage(null);
          notifyActionSuccess("Message deleted.");
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to delete message.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Failed to delete message.");
      },
    );
  };

  const handleOpen = (row: AdminMessageRow) => {
    setOpenMessage(row);
    if (row.status === "NEW") {
      void handleSetStatus(row, "READ", { silent: true });
    }
  };

  return (
    <section className="space-y-4">
      <MessageSummaryCards
        newCount={totals.newCount}
        readCount={totals.readCount}
        archivedCount={totals.archivedCount}
      />

      <MessagesToolbar
        query={query}
        statusFilter={statusFilter}
        visibleCount={visibleMessages.length}
        totalCount={messages.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        onRefresh={() => {
          void refreshMessages();
        }}
      />

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

      <MessagesTable
        messages={visibleMessages}
        isLoading={isLoading}
        totalCount={messages.length}
        busyId={busyId}
        onOpen={handleOpen}
        onSetStatus={(row, next) => {
          void handleSetStatus(row, next);
        }}
        onDelete={(row) => {
          void handleDelete(row);
        }}
      />

      {openMessage && (
        <MessageDrawer
          message={openMessage}
          onClose={() => setOpenMessage(null)}
          onSetStatus={(next) => {
            void handleSetStatus(openMessage, next);
          }}
          onDelete={() => {
            void handleDelete(openMessage);
          }}
          isBusy={busyId === openMessage.id}
        />
      )}
    </section>
  );
}
