import { useState } from "react";
import { tablePageSizes, type TablePageSize } from "@mizan/contracts";

export type CursorPage = { after?: string; limit: TablePageSize };

export function moveCursor(
  history: readonly string[],
  cursor?: string,
): readonly string[] {
  if (!cursor) return history.slice(0, -1);
  return history.includes(cursor) ? history : [...history, cursor];
}

export function useCursorPagination(identity = "") {
  const [limit, setLimit] = useState<TablePageSize>(tablePageSizes[0]);
  const [state, setState] = useState<{
    identity: string;
    history: readonly string[];
  }>({
    identity,
    history: [],
  });
  const history = state.identity === identity ? state.history : [];
  if (state.identity !== identity) setState({ identity, history });

  return {
    page: history.length + 1,
    request: { limit, after: history.at(-1) } satisfies CursorPage,
    setLimit: (next: TablePageSize) => {
      setLimit(next);
      setState({ identity, history: [] });
    },
    previous: () =>
      setState(({ history }) => ({ identity, history: moveCursor(history) })),
    next: (cursor: string) =>
      setState(({ history }) => ({
        identity,
        history: moveCursor(history, cursor),
      })),
  };
}
