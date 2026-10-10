import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "@/lib/errors";

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status: 200 });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.issues } },
      { status: 400 },
    );
  }
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: err.message, details: err.details } },
      { status: 400 },
    );
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: err.message } }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: { code: "CONFLICT", message: err.message } }, { status: 409 });
  }
  if (err instanceof ServiceUnavailableError) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: err.message } },
      { status: 503 },
    );
  }

  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}
