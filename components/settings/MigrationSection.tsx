"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { DRY_RUN_STEPS, MIGRATION_HISTORY } from "@/lib/mock/settingsMock";

export function MigrationSection() {
  const [revealed, setRevealed] = React.useState(0);
  const [running, setRunning] = React.useState(false);

  function runDryRun() {
    setRunning(true);
    setRevealed(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step >= DRY_RUN_STEPS.length) {
        clearInterval(timer);
        setRunning(false);
      }
    }, 450);
  }

  function reset() {
    setRevealed(0);
    setRunning(false);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      <Card className="flex flex-col gap-4 p-6">
        <CardTitle>Migration</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={runDryRun} disabled={running}>
            {running ? "Running…" : "Run dry run"}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
        <ol className="flex flex-col gap-2">
          {DRY_RUN_STEPS.map((step, i) => {
            const done = i < revealed;
            return (
              <li
                key={step.label}
                className="flex items-start gap-3 rounded-md border border-line p-3"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    done ? "border-navy bg-navy text-white" : "border-line text-muted"
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.label}</p>
                  {done ? <p className="text-sm text-muted">{step.result}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <CardTitle>Migration history</CardTitle>
        <ul className="flex flex-col gap-3">
          {MIGRATION_HISTORY.map((entry) => (
            <li key={entry.label} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
              <span className="text-sm font-semibold">{entry.label}</span>
              <div className="flex items-center gap-2">
                <Tag tone={entry.status === "Completed" ? "green" : "grey"}>{entry.status}</Tag>
                <span className="text-xs text-muted">{entry.timeLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
