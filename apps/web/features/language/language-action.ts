"use server";

import { cookies } from "next/headers";
import { localeCookie } from "./preference";

export async function changeLanguage(form: FormData) {
  const language = form.get("language");
  if (language !== "en" && language !== "az") return;
  (await cookies()).set(localeCookie, language, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.MIZAN_WEB_ORIGIN?.startsWith("https:") ?? false,
  });
}
