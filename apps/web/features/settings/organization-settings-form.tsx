"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import type { OrganizationSettings } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { SettingsForm } from "./settings-form";
import { SettingsSection } from "./settings-section";
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
    <SettingsSection
      title={copy.permissions}
      icon={<Shield aria-hidden="true" size={20} />}
    >
      <p className="text-mizan-muted">
        {copy.currency}: <strong>{settings.defaultCurrency}</strong>
      </p>
      <SettingsForm
        organizationId={organizationId}
        locale={locale}
        intent="visibility"
        label={copy.save}
      >
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="salespersonCanViewAcquisitionCost"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />
          <span>{copy.showCost}</span>
        </label>
      </SettingsForm>
    </SettingsSection>
  );
}
