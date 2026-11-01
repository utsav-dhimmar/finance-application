## 10. Epic G — Currency and Preferences

### US-024: Configure currency display

**As a user,** I want INR to be the default currency and want configurable currency preferences so that financial values are displayed consistently.

Acceptance criteria:

- Set INR as the initial default currency.
- Centralize currency formatting across forms, lists, reports, and charts.
- Use integer minor units for stored INR monetary amounts.
- Do not change stored transaction amounts when a display preference changes.
- Do not imply that changing display currency performs exchange-rate conversion.
- Treat multi-currency transactions and exchange-rate conversion as a separate future feature unless explicitly approved.
- Define the supported currency configuration model before implementation.

### US-025: Manage personal preferences

**As a user,** I want to manage basic application preferences so that the interface matches my needs.

Acceptance criteria:

- Persist supported preferences across sessions.
- Provide sensible defaults.
- Keep display preferences separate from financial records.
- Ensure preference changes do not silently modify historical monetary values.
