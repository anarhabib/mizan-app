"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import type { OrganizationSettings } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { SettingsForm, settingsPanel } from "./settings-form";
import { settingsCopy } from "./settings-copy";

export function OrganizationSettingsForm({
  organizationId,
  locale,
  settings,
}: {
  organizationId: string;
  locale: Locale;
  settings: OrganizationSettings;
}) {
  const copy = settingsCopy[locale];
  const [visible, setVisible] = useState(
    settings.salespersonCanViewAcquisitionCost,
  );
  return (
    <div className={settingsPanel}>
      <h2 className="flex items-center gap-2">
        <Shield aria-hidden="true" size={20} />
        {copy.permissions}
      </h2>
      <p className="text-mizan-muted">
        {copy.currency}: <strong>{settings.defaultCurrency}</strong>
      </p>
      <SettingsForm
        organizationId={organizationId}
        locale={locale}
        intent="visibility"
        label={copy.save}
      >
        <label className="settings-toggle">
          <input
            type="checkbox"
            name="salespersonCanViewAcquisitionCost"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />
          <span>{copy.showCost}</span>
        </label>
      </SettingsForm>
    </div>
  );
}
