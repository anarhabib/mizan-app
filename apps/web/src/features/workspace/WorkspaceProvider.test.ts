import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import workspace from "@/locales/az/workspace.json";
import { WorkspaceLoading } from "./WorkspaceProvider";

test("immediately announces workspace initialization while delaying the visual indicator", () => {
  const html = renderToStaticMarkup(createElement(WorkspaceLoading));
  expect(html).toContain('role="status"');
  expect(html).toContain(workspace.loading);
  expect(html).toContain("min-h-dvh");
  expect(html).not.toContain('data-slot="spinner"');
  expect(html).not.toContain('data-slot="skeleton"');
});
