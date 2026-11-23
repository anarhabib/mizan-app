import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ApiError } from "@/shared/lib/api";
import { QueryContent } from "./DashboardCard";

const query = {
  data: undefined as string | undefined,
  error: null as ApiError | null,
  isPending: false,
  isFetching: false,
  refetch: () => Promise.resolve(),
};

function render(changes: Partial<typeof query>) {
  return renderToStaticMarkup(
    createElement(QueryContent<string>, {
      query: { ...query, ...changes },
      children: (data) => createElement("p", null, data),
    }),
  );
}

test("shows a skeleton for an initial request and an actionable error when it fails", () => {
  expect(render({ isPending: true, isFetching: true })).toContain(
    'data-slot="skeleton"',
  );
  const failed = render({
    error: new ApiError(500, "INTERNAL_ERROR", "Internal details"),
  });
  expect(failed).toContain('role="alert"');
  expect(failed).toContain("<button");
  expect(failed).not.toContain("Internal details");
});

test("retains the displayed data through a background refresh", () => {
  const refreshing = render({ data: "Existing summary", isFetching: true });
  expect(refreshing).toContain("Existing summary");
  expect(refreshing).not.toContain('data-slot="skeleton"');
});
