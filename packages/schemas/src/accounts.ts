import { z } from "zod";

// Single source of truth for account validation rules, shared by the API, the
// web app, and the future mobile client. OpenAPI metadata for the API's route
// schemas is layered on top of these in server/api/src/schemas — do not add
// transport concerns here.

export const accountTypes = ["cash", "bank", "wallet"] as const;
export const accountTypeSchema = z.enum(accountTypes);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const accountStatuses = ["active", "archived", "deleted"] as const;
export const accountStatusSchema = z.enum(accountStatuses);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const ACCOUNT_NAME_MAX_LENGTH = 80;

export const accountNameSchema = z
	.string()
	.trim()
	.min(1, "Account name is required")
	.max(
		ACCOUNT_NAME_MAX_LENGTH,
		`Account name must be at most ${ACCOUNT_NAME_MAX_LENGTH} characters`,
	);

// Money crosses the wire as integer minor units (paise) only; binary floats
// are never an authoritative amount (AGENTS.md rule).
export const amountMinorSchema = z.number().int();

// Rupee-decimal string (form input) → integer paise, parsed digit-by-digit so
// no binary floating-point arithmetic ever touches the value. An empty string
// means zero so an optional opening-balance field can submit empty. "1250.5"
// pads to .50; more than 2 decimals or anything non-numeric is rejected.
export const amountInputSchema = z
	.string()
	.trim()
	.regex(
		/^(|-?\d{1,13}(\.\d{1,2})?)$/,
		"Enter a rupee amount with at most 2 decimals, e.g. 1250.50",
	)
	.transform((value) => {
		if (value === "") {
			return 0;
		}
		const negative = value.startsWith("-");
		const unsigned = negative ? value.slice(1) : value;
		const whole = unsigned.split(".")[0] ?? "0";
		const fraction = (unsigned.split(".")[1] ?? "").padEnd(2, "0").slice(0, 2);
		const paise = Number(`${whole}${fraction}`);
		return negative ? -paise : paise;
	});

export const createAccountBodySchema = z.object({
	name: accountNameSchema,
	type: accountTypeSchema,
	openingBalanceMinor: amountMinorSchema.default(0),
});

export const updateAccountBodySchema = z.object({
	name: accountNameSchema.optional(),
	type: accountTypeSchema.optional(),
	openingBalanceMinor: amountMinorSchema.optional(),
});

export const restoreAccountBodySchema = z.object({
	newName: accountNameSchema.optional(),
});

export const accountResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: accountTypeSchema,
	openingBalanceMinor: z.number().int(),
	currentBalanceMinor: z.number().int(),
	status: accountStatusSchema,
	archivedAt: z.string().nullable(),
	deletedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const accountListResponseSchema = z.object({
	accounts: z.array(accountResponseSchema),
	combinedBalanceMinor: z.number().int(),
});

// Web form input: the opening balance is a rupee string; the parsed output
// maps 1:1 onto CreateAccountBody for the API call.
export const accountFormSchema = z.object({
	name: accountNameSchema,
	type: accountTypeSchema,
	openingBalance: amountInputSchema,
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type RestoreAccountBody = z.infer<typeof restoreAccountBodySchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type AccountListResponse = z.infer<typeof accountListResponseSchema>;
export type AccountFormInput = z.input<typeof accountFormSchema>;
export type AccountFormValues = z.output<typeof accountFormSchema>;
