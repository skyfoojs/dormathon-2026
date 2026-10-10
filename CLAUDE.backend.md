# Backend Rules (Next.js App Router)

Stack assumption: Next.js App Router, TypeScript, route handlers (`route.ts`) and/or server actions. Use whichever ORM, auth, and validation libraries the project already has. Do not introduce new ones without asking.

## 0. Golden rule
Keep it simple: each endpoint lives in its own `route.ts`. No service layer, no controllers, no repositories. But inside the file, every function does ONE thing. Validate everything at the boundary, and reuse existing helpers before writing new ones.

## 1. Forbidden (hard rules)
- NO service, controller, or repository layers. Do not create them.
- NO unvalidated input. Never trust `req.json()`, `searchParams`, `params`, `FormData`, headers, or cookies.
- NO secrets in code, in client components, or in `NEXT_PUBLIC_*` variables. Never log secrets, tokens, or passwords.
- NO `any`. NO `as` casts to silence errors on external data. Parse with a schema instead.
- NO swallowed errors (`catch {}`) and NO leaking stack traces or raw DB errors to the client.
- NO string-concatenated SQL. Use the ORM or parameterized queries only.
- NO N+1 queries. Batch with joins, `include`, or `IN` queries.
- NO new API response shape. Use the shared response helpers (section 5).
- NO one giant function that parses, authenticates, queries, and formats in one block (see section 3).
- NO importing server-only code into client components. Mark server-only modules with `import "server-only"`.

## 2. Project structure
Follow the existing structure. If none exists, use:
```
src/
  app/api/<resource>/route.ts          # list + create
  app/api/<resource>/[id]/route.ts     # get + update + delete
  app/<route>/actions.ts               # server actions (same rules as route.ts)
  lib/                                 # shared helpers used by 2+ routes
    db.ts                              # DB client singleton
    auth.ts                            # requireAuth(), getSession()
    env.ts                             # validated env vars
    errors.ts                          # typed errors
    response.ts                        # ok(), created(), errorResponse()
    logger.ts
```
- Everything specific to one endpoint stays in that endpoint's `route.ts` (schema, queries, mapping).
- Move something to `lib/` only when a second route needs it. Do not pre-abstract.
- Search `lib/` and other routes for an existing helper before writing a new one.

## 3. Single responsibility inside route.ts
Each exported HTTP method (`GET`, `POST`, ...) is a short orchestrator that reads like a recipe. Each step is its own small named function in the same file, doing exactly one job.

Order inside a file:
1. Imports
2. Schemas (validation) at the top
3. Exported handlers (`GET`, `POST`, ...)
4. Small helper functions below (one responsibility each): `findUsers`, `createUser`, `toUserDto`, `assertOwnsProject`, etc.

Rules:
- A handler does: validate input, check auth, call helpers, return a response. It does not contain raw query logic or data-mapping logic inline.
- DB access goes in small named functions (`findInvoiceById`, `insertInvoice`), not inline in the handler.
- Mapping DB rows to response objects goes in its own function (`toInvoiceDto`).
- Authorization checks (ownership, roles) go in their own function.
- If a helper is getting long or doing two things, split it.
- Keep functions short. If a function needs "and" to describe it, it is two functions.

## 4. Validation
- Define one schema per input (zod or the project's existing library). Derive TS types from schemas (`z.infer`), do not write types by hand twice.
- Validate at the boundary: body, query params, route params, form data.
- On failure return 400 (or 422) with field-level errors in the standard error shape.
- Coerce and sanitize at the schema level (trim, lowercase emails, `z.coerce.number()` for query params).

## 5. API design and responses
- REST naming: plural nouns (`/api/users`), no verbs in paths. Proper methods: GET read, POST create, PUT/PATCH update, DELETE remove.
- Use correct status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.
- Use ONE response envelope everywhere, built by shared helpers in `lib/response.ts`:
```ts
// success
{ "data": <payload>, "meta"?: { "page": 1, "pageSize": 20, "total": 120 } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details"?: [...] } }
```
- Always paginate list endpoints (`page`/`pageSize` or cursor). Cap `pageSize` (e.g. max 100). Support sort and filter through validated params.
- Never return raw DB rows with sensitive fields. Map to a DTO and select only needed columns (no password hashes, tokens, internal flags).

## 6. Errors
- Define a small set of typed errors (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) in `lib/errors.ts`.
- Helpers throw typed errors. Each handler wraps its body in one `try/catch` and returns `errorResponse(err)`, which maps typed errors to the right status and the standard error shape.
- Unknown errors: log full details server-side, return a generic 500 message to the client.
- Never use `try/catch` just to console.log. Handle it or pass it to `errorResponse`.

## 7. Auth and security
- Authenticate in every protected route handler and server action. Do not rely on middleware alone.
- Authorize per resource: verify the user owns or may access the record (prevent IDOR). Never trust IDs from the client without an ownership check.
- Server actions are public endpoints. Validate input and check auth inside each one.
- Hash passwords with bcrypt/argon2. Use httpOnly, secure, sameSite cookies for sessions. Keep tokens out of localStorage.
- Rate limit auth and write-heavy endpoints. Add CSRF protection where cookies are used for mutating requests outside server actions.
- Set CORS explicitly if the API is used cross-origin. Never use `*` with credentials.
- Validate file uploads (type, size) and never trust the client-provided filename or MIME type.

## 8. Database
- Use the project's ORM through the shared client in `lib/db.ts`.
- Use transactions for multi-step writes that must succeed or fail together.
- Add indexes for columns used in `where`, `orderBy`, and joins. Add unique constraints in the schema, not just in app code.
- Select only needed fields. Avoid fetching whole rows on large tables.
- Schema changes go through migrations only. Never edit the DB by hand or reset data without being asked.
- Soft-delete only if the project already does. Match existing conventions.

## 9. Config and environment
- Read env vars in ONE place (`lib/env.ts`) and validate them at startup with a schema. Import `env` from there. Do not scatter `process.env.X` through the code.
- Only `NEXT_PUBLIC_*` vars may reach the client, and they must never hold secrets.
- Document any new env var in `.env.example` (no real values).

## 10. Next.js specifics
- Default to Server Components and server-side data fetching. Do not call your own API route from a server component. If a query is needed by both a page and a route, move that query function to `lib/` and import it in both.
- Use route handlers for external clients, webhooks, and non-form integrations. Use server actions for form mutations from your own UI.
- Set `export const dynamic`/`revalidate` deliberately. Know what is cached. After mutations, call `revalidatePath` or `revalidateTag`.
- Use `export const runtime = "nodejs"` where Node APIs or heavy ORM clients are needed.
- Reuse a single DB client instance (singleton pattern for dev hot reload).
- Webhooks: verify the signature, make handlers idempotent, respond fast, process heavy work asynchronously.
- Use `next/headers` (`cookies()`, `headers()`) only on the server.

## 11. Logging
- Use the shared logger, not scattered `console.log`. Log route and error context. Never log PII, passwords, or tokens.
- Log at the right level (info for events, warn for recoverable issues, error for failures).

## 12. Code quality
- TypeScript strict. Explicit return types on helper functions.
- Descriptive names (`createInvoice`, not `handle`). Functions named for what they do.
- No dead code, no commented-out blocks, no TODOs without context.
- Reuse existing utilities (date, money, pagination, slug, etc.). Search before writing a new one.
- Match existing naming, file layout, and error-handling patterns in the repo.

## 13. Good vs bad

Bad: everything in one blob, no validation, no auth, leaky.
```ts
export async function POST(req: Request) {
  const body = await req.json();
  const user = await db.user.create({ data: body });
  return Response.json(user);
}
```

Good: everything in route.ts, but each part has one job.
```ts
// app/api/users/route.ts
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { created, errorResponse } from "@/lib/response";

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(req: Request) {
  try {
    await requireAuth();
    const input = createUserSchema.parse(await req.json());
    const user = await insertUser(input);
    return created(toUserDto(user));
  } catch (err) {
    return errorResponse(err);
  }
}

async function insertUser(input: z.infer<typeof createUserSchema>) {
  return db.user.create({ data: input });
}

function toUserDto(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}
```

## 14. Before you say you're done (checklist)
1. Each `route.ts` is one file with no service/controller/repository layers, and every function in it does one thing.
2. Handlers are short orchestrators. Queries, mapping, and authorization checks are in their own small named functions.
3. All external input is validated with a schema. No `any` or unchecked casts.
4. Auth and per-resource authorization checked. No IDOR, no secrets exposed.
5. Used existing `lib/` helpers (db, auth, response, errors, env) instead of creating duplicates.
6. No N+1 queries, list endpoints are paginated, sensitive fields excluded from responses.
7. New env vars added to the env schema and `.env.example`.
8. Cache revalidation handled after mutations.
9. Run lint and type-check and fix everything.
10. Briefly list any deviation from these rules and why.
