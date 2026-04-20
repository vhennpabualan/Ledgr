import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Handles optimistic delete with a CSS exit animation.
 *
 * 1. Adds the item ID to `exitingIds` immediately → apply `item-exit` class
 * 2. After 180ms (animation duration), fires the real API delete
 * 3. Refetches the list query when done
 *
 * @param queryKey  React Query key to refetch after deletion
 */
export function useAnimatedDelete(queryKey: unknown[]) {
  const queryClient = useQueryClient();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const triggerDelete = useCallback(
    (id: string, mutationFn: () => Promise<unknown>) => {
      // Kick off exit animation immediately
      setExitingIds((prev) => new Set(prev).add(id));

      setTimeout(async () => {
        try {
          await mutationFn();
        } finally {
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          queryClient.refetchQueries({ queryKey });
        }
      }, 180); // must match itemExit animation duration in index.css
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)],
  );

  return { exitingIds, triggerDelete };
}
