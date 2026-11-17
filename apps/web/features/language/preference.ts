import { cookies } from "next/headers";
import { parseLocale } from "./messages";

export const localeCookie = "mizan-language";

export async function currentLocale() {
  return parseLocale((await cookies()).get(localeCookie)?.value);
}
