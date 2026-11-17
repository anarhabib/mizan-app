import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { MemberManagement } from "./member-management";

vi.mock("./membership-actions", () => ({ updateMembers: vi.fn() }));

test("shows localized invitation status and grants only the available management actions", () => {
  const invitation = {
    email: "new@example.com",
    storeId: "first",
    expiresAt: "2026-11-20T00:00:00Z",
  };
  const html = renderToStaticMarkup(
    <MemberManagement
      organizationId="org"
      locale="az"
      directory={{
        stores: [
          { id: "first", name: "Bakı" },
          { id: "second", name: "Gəncə" },
        ],
        invitations: [
          { ...invitation, id: "pending", status: "pending" },
          { ...invitation, id: "accepted", status: "accepted" },
        ],
        members: [
          {
            userId: "first-user",
            email: "active@example.com",
            status: "active",
            storeIds: ["first"],
          },
          {
            userId: "second-user",
            email: "inactive@example.com",
            status: "inactive",
            storeIds: [],
          },
        ],
      }}
    />,
  );
  for (const label of [
    "Gözləyir",
    "Qəbul edilib",
    "Aktiv",
    "Deaktiv",
    "Dəvəti ləğv et",
    "Yenidən göndər",
    "Mağaza icazəsi ver",
    "Mağaza icazəsini sil",
  ]) {
    expect(html).toContain(label);
  }
  expect(html.match(/Dəvəti ləğv et/g)).toHaveLength(1);
});
