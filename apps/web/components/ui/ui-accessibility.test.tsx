import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Button } from "./button";
import { Field } from "./field";
import { Dialog } from "./dialog";

test("labels fields and connects inline errors to the input", () => {
  const html = renderToStaticMarkup(
    <Field id="email" label="Email" error="Enter an email" />,
  );
  expect(html).toContain('for="email"');
  expect(html).toContain('aria-describedby="email-error"');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain("min-h-11");
});

test("provides visible keyboard focus and a 44px action target", () => {
  const html = renderToStaticMarkup(<Button>Save</Button>);
  expect(html).toContain("focus-visible:outline-2");
  expect(html).toContain("min-h-11");
});

test("renders a named native dialog with a labeled close control", () => {
  const html = renderToStaticMarkup(
    <Dialog title="Settings" closeLabel="Close" onClose={() => {}}>
      Content
    </Dialog>,
  );
  expect(html).toContain("<dialog");
  expect(html).toContain("aria-labelledby=");
  expect(html).toContain('aria-label="Close"');
});
