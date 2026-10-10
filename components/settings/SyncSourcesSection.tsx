"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Label, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";

const SENSITIVITY_LABELS = ["Very low", "Low", "Medium", "High", "Very high"];

export function SyncSourcesSection() {
  const [scheduledSync, setScheduledSync] = React.useState(true);
  const [syncOnInput, setSyncOnInput] = React.useState(true);
  const [covid, setCovid] = React.useState(false);
  const [ili, setIli] = React.useState(false);
  const [aiCheck, setAiCheck] = React.useState(true);
  const [frequency, setFrequency] = React.useState("hourly");
  const [sensitivity, setSensitivity] = React.useState(2);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardTitle>Sync and sources</CardTitle>

      <div className="flex flex-col divide-y divide-line">
        <Switch id="sync-scheduled" label="Scheduled sync" checked={scheduledSync} onCheckedChange={setScheduledSync} />
        <Switch id="sync-on-input" label="Sync when saving new input" checked={syncOnInput} onCheckedChange={setSyncOnInput} />
        <Switch id="sync-covid" label="COVID-19 activity" checked={covid} onCheckedChange={setCovid} />
        <Switch id="sync-ili" label="Influenza-like illness (ILI)" checked={ili} onCheckedChange={setIli} />
        <Switch id="sync-ai-check" label="AI check for unusual input" checked={aiCheck} onCheckedChange={setAiCheck} />
      </div>

      <Field label="Scheduled sync frequency" htmlFor="sync-frequency" className="max-w-xs">
        <Select
          id="sync-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={!scheduledSync}
        >
          <option value="15min">Every 15 minutes</option>
          <option value="hourly">Hourly</option>
          <option value="6hr">Every 6 hours</option>
          <option value="daily">Daily</option>
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <Label htmlFor="alert-sensitivity">
          Alert sensitivity: {SENSITIVITY_LABELS[sensitivity]}
        </Label>
        <input
          id="alert-sensitivity"
          type="range"
          min={0}
          max={4}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="h-11 w-full max-w-sm accent-navy"
        />
        <p className="text-xs text-muted">
          Higher means more warnings, including some that turn out to be
          nothing.
        </p>
      </div>
    </Card>
  );
}
