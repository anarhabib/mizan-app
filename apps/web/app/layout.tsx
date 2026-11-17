import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import { currentLocale } from "../features/language/preference";
import "./globals.css";

export const metadata: Metadata = { title: "Mizan" };
export const viewport: Viewport = {
  themeColor: "#0b2b26",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await currentLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
