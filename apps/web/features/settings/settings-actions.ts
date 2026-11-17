"use server";

import { parsePurity, parseRate } from "@mizan/contracts";
import { revalidatePath } from "next/cache";
import { apiRequest } from "../auth/session";
import { currentLocale } from "../language/preference";
import { settingsCopy } from "./settings-copy";

type State = { error?: string; notice?: string };

export async function updateSettings(
  organizationId: string,
  _state: State,
  form: FormData,
): Promise<State> {
  const copy = settingsCopy[await currentLocale()];
  const base = `/organizations/${encodeURIComponent(organizationId)}` as const;
  const intent = form.get("intent");
  const raw = form.get("purity");
  const purity =
    typeof raw === "string" && /^[1-9]\d{0,2}$/.test(raw)
      ? parsePurity(Number(raw))
      : null;
  let path: `/organizations/${string}`;
  let payload: object;
  if (intent === "visibility") {
    path = `${base}/settings`;
    payload = {
      salespersonCanViewAcquisitionCost:
        form.get("salespersonCanViewAcquisitionCost") === "on",
    };
  } else if (intent === "purity" && purity !== null) {
    path = `${base}/purities`;
    payload = { value: purity };
  } else if (intent === "deactivate" && purity !== null) {
    path = `${base}/purities/${purity}/deactivate`;
    payload = {};
  } else if (intent === "rate") {
    const amount = form.get("amountPerGram");
    const rate = parseRate({
      purity,
      currency: form.get("currency"),
      amountPerGram:
        typeof amount === "string" ? amount.trim().replace(",", ".") : amount,
    });
    if (!rate) return { error: copy.invalid };
    path = `${base}/rates`;
    payload = rate;
  } else return { error: copy.invalid };
  const result = await apiRequest(path, payload);
  if (result.status === 401 || result.status === 403)
    return { error: copy.denied };
  if (result.status === 409) return { error: copy.conflict };
  if (result.status === 400) return { error: copy.invalid };
  if (result.status !== 200) return { error: copy.failure };
  revalidatePath("/settings");
  return { notice: copy.saved };
}
