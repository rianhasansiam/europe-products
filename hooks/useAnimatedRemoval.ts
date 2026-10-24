"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LIST_REMOVAL_DURATION_MS } from "@/lib/motion/list-removal";

type RemovableId = string | number;

type UseAnimatedRemovalOptions<TItem, TId extends RemovableId> = {
  items: TItem[];
  getId: (item: TItem) => TId;
  durationMs?: number;
};

type RemoveCommit = () => Promise<void> | void;
type RemoveBatchCommit<TId extends RemovableId> = (
  ids: TId[],
) => Promise<void> | void;

export function useAnimatedRemoval<TItem, TId extends RemovableId>({
  items,
  getId,
  durationMs = LIST_REMOVAL_DURATION_MS,
}: UseAnimatedRemovalOptions<TItem, TId>) {
  const [removingIds, setRemovingIds] = useState<Set<TId>>(() => new Set());
  const timersRef = useRef<Map<TId, ReturnType<typeof setTimeout>>>(new Map());
  const removingIdsRef = useRef(removingIds);

  useEffect(() => {
    removingIdsRef.current = removingIds;
  }, [removingIds]);

  useEffect(() => {
    setRemovingIds((prev) => {
      if (prev.size === 0) return prev;

      const liveIds = new Set(items.map((item) => getId(item)));
      let changed = false;
      const next = new Set(prev);

      for (const id of prev) {
        if (!liveIds.has(id)) {
          changed = true;
          next.delete(id);
          const timer = timersRef.current.get(id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
          }
        }
      }

      return changed ? next : prev;
    });
  }, [getId, items]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    },
    [],
  );

  const queueRemoval = useCallback(
    (id: TId, commit: RemoveCommit, onError?: (error: unknown) => void) => {
      if (removingIdsRef.current.has(id)) return;

      setRemovingIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        Promise.resolve(commit()).catch((error) => {
          setRemovingIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          onError?.(error);
        });
      }, durationMs);

      timersRef.current.set(id, timer);
    },
    [durationMs],
  );

  const queueBatchRemoval = useCallback(
    (
      ids: TId[],
      commit: RemoveBatchCommit<TId>,
      onError?: (error: unknown) => void,
    ) => {
      const nextIds = Array.from(new Set(ids)).filter(
        (id) => !removingIdsRef.current.has(id),
      );
      if (nextIds.length === 0) return;

      setRemovingIds((prev) => {
        const next = new Set(prev);
        for (const id of nextIds) next.add(id);
        return next;
      });

      const timer = setTimeout(() => {
        for (const id of nextIds) {
          timersRef.current.delete(id);
        }

        Promise.resolve(commit(nextIds)).catch((error) => {
          setRemovingIds((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const id of nextIds) {
              if (next.delete(id)) changed = true;
            }
            return changed ? next : prev;
          });
          onError?.(error);
        });
      }, durationMs);

      for (const id of nextIds) {
        timersRef.current.set(id, timer);
      }
    },
    [durationMs],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !removingIds.has(getId(item))),
    [getId, items, removingIds],
  );

  const isRemoving = useCallback((id: TId) => removingIds.has(id), [removingIds]);

  return {
    durationMs,
    isRemoving,
    queueBatchRemoval,
    queueRemoval,
    removingIds,
    visibleItems,
  };
}
