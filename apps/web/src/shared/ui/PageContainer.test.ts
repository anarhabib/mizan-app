import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PageContainer } from "./PageContainer";

it("exposes the three responsive content widths and defaults to standard", () => {
  for (const width of [undefined, "wide", "standard", "narrow"] as const) {
    const markup = renderToStaticMarkup(
      createElement(PageContainer, { width }),
    );
    expect(markup).toContain('class="page-container"');
    expect(markup).toContain(`data-width="${width ?? "standard"}"`);
  }
});
