"use client";

import * as React from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { DB_TYPES, type DbType } from "@/lib/mock/settingsMock";

export function DatabaseConnectionSection() {
  const [type, setType] = React.useState<DbType>("PostgreSQL");
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState(DB_TYPES[0].defaultPort ?? "");
  const [database, setDatabase] = React.useState("");
  const [user, setUser] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [result, setResult] = React.useState<"idle" | "missing" | "reachable">("idle");

  const needsHostPort = type !== "SQLite" && type !== "CSV or SQL file upload";

  function handleTypeChange(next: DbType) {
    setType(next);
    const defaultPort = DB_TYPES.find((d) => d.type === next)?.defaultPort;
    setPort(defaultPort ?? "");
    setResult("idle");
  }

  function testConnection() {
    const hasRequired = (!needsHostPort || host.trim()) && database.trim() && user.trim();
    setResult(hasRequired ? "reachable" : "missing");
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardTitle>Database connection</CardTitle>
      <CardBody className="gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Database type" htmlFor="db-type">
            <Select id="db-type" value={type} onChange={(e) => handleTypeChange(e.target.value as DbType)}>
              {DB_TYPES.map((d) => (
                <option key={d.type} value={d.type}>
                  {d.type}
                </option>
              ))}
            </Select>
          </Field>
          {needsHostPort ? (
            <>
              <Field label="Host" htmlFor="db-host">
                <Input id="db-host" value={host} onChange={(e) => { setHost(e.target.value); setResult("idle"); }} />
              </Field>
              <Field label="Port" htmlFor="db-port">
                <Input id="db-port" value={port} onChange={(e) => setPort(e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="flex items-end text-sm text-muted">No host or port needed for this type.</div>
          )}
          <Field label="Database name" htmlFor="db-name">
            <Input id="db-name" value={database} onChange={(e) => { setDatabase(e.target.value); setResult("idle"); }} />
          </Field>
          <Field label="Read-only user" htmlFor="db-user">
            <Input id="db-user" value={user} onChange={(e) => { setUser(e.target.value); setResult("idle"); }} />
          </Field>
          <Field label="Password" htmlFor="db-password" hint="Never stored.">
            <Input
              id="db-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={testConnection}>
            Test connection
          </Button>
          {result === "missing" ? <Tag tone="amber">Missing details</Tag> : null}
          {result === "reachable" ? (
            <>
              <Tag tone="green">Reachable</Tag>
              <span className="text-sm text-muted">Nothing was contacted. Design only.</span>
            </>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
