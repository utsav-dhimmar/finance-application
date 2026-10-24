## Mission

- Build a secure, reliable, single-user personal finance application .
- The application should support expense tracking, income tracking, categories, budgets, recurring transactions, analytics, and other personal finance features as defined by approved specifications.
- Use OpenSpec for specification-driven development. Treat approved specifications, architecture decisions, and repository conventions as the source of truth.
- Implement only the scope of the current task. Do not invent requirements or expand scope without approval.

## Non-Negotiable Engineering Rules

1. TypeScript only
   - Use TypeScript for application code, tests, scripts, and configuration wherever supported.
   - Enable TypeScript strict mode.
   - Avoid any. Prefer unknown and narrow types safely.
   - Avoid @ts-ignore, @ts-nocheck, unsafe casts, and non-null assertions without a documented justification.
2. Monorepo
   - Keep applications, shared packages, API, database code, tests, and configuration in one repository.
   - Avoid circular dependencies between workspace packages.
3. Tech Stack
   - Package manager pnpm
   - TanStack Start for the web application.
   - Hono for the HTTP API.
   - Zod for validation.
   - Cloudflare Workers for hosting and runtime.
   - Cloudflare D1 for persistent SQL storage.
   - Drizzle ORM for typed database access and migrations.
   - OpenAPI with Scalar for interactive API specification.
   - TanStack Query for server state.
   - TanStack Table for data tables.
   - shadcn/ui with Base UI primitives.
   - Lucide for icons.
   - Recharts for charts.
   - Vitest for testing.
   - GitHub Actions for CI/CD.
4. One authoritative backend API.
   - Hono owns the HTTP API implementation.
   - Both the web application and future Android application consume the same API.
   - Do not duplicate business logic across clients.
   - Do not expose D1 bindings or database credentials to client applications.
5. Prefer small, cohesive, testable changes.
6. Never claim that a command, test, migration, build, or deployment succeeded unless it was actually executed and its result inspected.

## Monorepo Structure

A possible starting layout:

```text
personal-finance/
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── openspec/
│   └── ...
├── apps/
│   ├── web/                  # TanStack Start
│   └── android/              # Future Expo application
├── packages/
│   ├── domain/               # Finance rules and calculations
│   ├── schemas/              # Shared validation schemas
│   ├── api-client/           # Typed API client
│   ├── config/               # Shared tooling configuration
│   └── ui/                   # Shared UI utilities where appropriate
├── server/
│   └── api/                  # Hono API and Cloudflare Worker entry
├── db/
│   └── ...                   # Drizzle schema and migrations
└── .github/
    └── workflows/            # GitHub Actions
```

This layout is illustrative, not mandatory. Choose workspace boundaries based on actual dependencies and deployment requirements.

Do not create every package or directory before it is needed.

### Workspace dependency rules

- `domain` must remain platform-independent.
- `schemas` must not depend on application entry points.
- `api-client` must not expose server secrets or import server-only modules.
- Database access belongs in server-only code.
- Shared packages must not import from application entry points.
- Avoid duplicated domain logic and circular dependencies.
- Use Zod as the source of truth for runtime validation of request inputs, query parameters, route parameters, and relevant response data.
- Infer TypeScript types from Zod schemas using z.infer instead of duplicating types manually.

## Personal Finance Data Integrity

Financial correctness is a core requirement.

- Store monetary values as integer minor units, such as paise for INR.
- Never use binary floating-point values as the authoritative representation of money.
- Document currency handling and rounding rules.
- Validate amounts, dates, transaction types, currency values, and category references on the server.
- Use database constraints and transactions when multiple changes must remain consistent.
- Distinguish transaction dates from creation and update timestamps.
- Avoid accidental timezone shifts in date-based financial reports.
- Define refund, transfer, recurring transaction, deletion, budget-period, and month-boundary behavior in specifications.
- Use stable UUIDv7 for transaction identifiers.
- Make write operations idempotent where retries could create duplicate records.
- Do not silently rewrite historical transactions when categories or preferences change.
- Never log passwords, session tokens, secrets, or unnecessary sensitive financial details.

## Definition of Done

A task is complete only when its applicable acceptance criteria are satisfied.

Before completing a task:

- Verify the implementation against the approved specification.
- Run applicable Vitest tests.
- Run TypeScript type checking.
- Run lint and formatting checks.
- Run OpenAPI validation when API behavior changes.
- Run the production build when appropriate.
- Validate migrations when the database schema changes.
- Review security-sensitive changes.
- Update documentation and specifications when required.
- Report incomplete checks and known limitations honestly.
