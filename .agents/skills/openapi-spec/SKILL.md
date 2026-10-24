---
name: openapi-spec
description: Openapi specification Genration, use when writing api contracts
---

- Maintain a valid OpenAPI 3.x specification.
- Treat the specification as a first-class API contract.
- Integrate Zod with Hono and OpenAPI generation so API documentation stays aligned with actual validation schemas.
- Provide Scalar API Reference UI backed by the current OpenAPI document.
- Document which API documentation endpoints are available in production.
- Avoid maintaining separate validation schemas and OpenAPI definitions for the same data when they can be derived from a single Zod schema.
- Do not expose secrets, private examples, or internal-only endpoints in public documentation.
- Use an intentional API versioning strategy, preferably `/api/v1` for externally consumed endpoints.
- Add CI checks to validate the OpenAPI document and detect specification drift.
- Add API contract tests for success responses, validation errors, and authentication failures.
