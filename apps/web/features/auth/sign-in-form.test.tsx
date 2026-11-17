import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { SignInFields } from "./sign-in-form";

vi.mock("./owner-actions", () => ({ submitSignIn: vi.fn() }));

test("shows the auth error and preserves the email with labeled credential controls", () => {
  const html = renderToStaticMarkup(
    <SignInFields locale="en" email="owner@example.com" error="Try again" />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Try again");
  expect(html).toContain('value="owner@example.com"');
  expect(html).toContain('for="signin-password"');
  expect(html).toContain('autoComplete="current-password"');
  expect(html).toContain('aria-label="Show password"');
});
