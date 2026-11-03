import { describe, expect, it } from "vitest";
import { NOTES_MAX_LENGTH } from "../src/transactions";
import {
	activityListQuerySchema,
	createTransferBodySchema,
	restoreTransferBodySchema,
	transferAmountSchema,
	transferDateSchema,
	transferFormSchema,
	transferIdSchema,
	transferListQuerySchema,
	updateTransferBodySchema,
} from "../src/transfers";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";
const UUID_V4 = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("transferAmountSchema", () => {
	it("accepts positive integer paise", () => {
		expect(transferAmountSchema.parse(125050)).toBe(125050);
		expect(transferAmountSchema.parse(1)).toBe(1);
	});

	it.each([0, -1, -125050, 12.5])("rejects %p", (input) => {
		expect(() => transferAmountSchema.parse(input)).toThrow();
	});
});

describe("transferDateSchema", () => {
	it.each(["2026-01-31", "2024-02-29", "2026-12-01"])("accepts %s", (input) => {
		expect(transferDateSchema.parse(input)).toBe(input);
	});

	it.each(["2026-02-30", "2026-13-01", "2026/01/01", ""])(
		"rejects %s",
		(input) => {
			expect(() => transferDateSchema.parse(input)).toThrow();
		},
	);
});

describe("transferIdSchema", () => {
	it("accepts a UUIDv7 and rejects other UUID versions", () => {
		expect(transferIdSchema.parse(UUID_V7)).toBe(UUID_V7);
		expect(() => transferIdSchema.parse(UUID_V4)).toThrow();
		expect(() => transferIdSchema.parse("not-a-uuid")).toThrow();
	});
});

describe("createTransferBodySchema", () => {
	const valid = {
		id: UUID_V7,
		amountMinor: 125050,
		date: "2026-01-15",
		sourceAccountId: "acc-1",
		destinationAccountId: "acc-2",
	};

	it("accepts a valid body and trims notes", () => {
		const parsed = createTransferBodySchema.parse({
			...valid,
			notes: "  cash withdrawal  ",
		});
		expect(parsed).toMatchObject({ ...valid, notes: "cash withdrawal" });
	});

	it("rejects identical source and destination accounts", () => {
		expect(() =>
			createTransferBodySchema.parse({
				...valid,
				destinationAccountId: "acc-1",
			}),
		).toThrow(/different/);
	});

	it.each([
		["zero amount", { amountMinor: 0 }],
		["negative amount", { amountMinor: -100 }],
		["fractional paise", { amountMinor: 12.5 }],
	])("rejects a body with a %s", (_label, patch) => {
		expect(() =>
			createTransferBodySchema.parse({ ...valid, ...patch }),
		).toThrow();
	});

	it("rejects a non-UUIDv7 id", () => {
		expect(() =>
			createTransferBodySchema.parse({ ...valid, id: UUID_V4 }),
		).toThrow();
	});

	it("rejects an invalid calendar date", () => {
		expect(() =>
			createTransferBodySchema.parse({ ...valid, date: "2026-02-30" }),
		).toThrow();
	});

	it("rejects notes beyond the limit", () => {
		expect(() =>
			createTransferBodySchema.parse({
				...valid,
				notes: "a".repeat(NOTES_MAX_LENGTH + 1),
			}),
		).toThrow();
	});
});

describe("updateTransferBodySchema", () => {
	it("accepts partial patches", () => {
		expect(updateTransferBodySchema.parse({})).toEqual({});
		expect(
			updateTransferBodySchema.parse({ amountMinor: 500, notes: null }),
		).toEqual({ amountMinor: 500, notes: null });
	});

	it("exposes no status field", () => {
		const parsed = updateTransferBodySchema.parse({
			amountMinor: 500,
			status: "archived",
		}) as { status?: string };
		expect(parsed.status).toBeUndefined();
	});

	it("rejects invalid patches", () => {
		expect(() => updateTransferBodySchema.parse({ amountMinor: 0 })).toThrow();
		expect(() =>
			updateTransferBodySchema.parse({ date: "2026-13-01" }),
		).toThrow();
	});
});

describe("restoreTransferBodySchema", () => {
	it("accepts an empty body and optional replacements", () => {
		expect(restoreTransferBodySchema.parse({})).toEqual({});
		expect(
			restoreTransferBodySchema.parse({
				sourceAccountId: "acc-1",
				destinationAccountId: "acc-2",
			}),
		).toEqual({
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
		});
	});
});

describe("transferListQuerySchema", () => {
	it("defaults status and pagination", () => {
		expect(transferListQuerySchema.parse({})).toEqual({
			status: "active",
			page: 1,
			pageSize: 20,
		});
	});

	it("coerces pagination numbers and caps pageSize at 100", () => {
		expect(
			transferListQuerySchema.parse({ page: "2", pageSize: "50" }),
		).toMatchObject({ page: 2, pageSize: 50 });
		expect(() => transferListQuerySchema.parse({ pageSize: 101 })).toThrow();
	});

	it("rejects unknown statuses", () => {
		expect(() => transferListQuerySchema.parse({ status: "nope" })).toThrow();
	});
});

describe("transferFormSchema", () => {
	const valid = {
		amount: "1250.50",
		date: "2026-01-15",
		sourceAccountId: "acc-1",
		destinationAccountId: "acc-2",
	};

	it("parses the rupee string into integer paise", () => {
		expect(transferFormSchema.parse(valid)).toMatchObject({
			amount: 125050,
			date: "2026-01-15",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
		});
	});

	it("rejects same-account selections", () => {
		expect(() =>
			transferFormSchema.parse({
				...valid,
				destinationAccountId: "acc-1",
			}),
		).toThrow(/different/);
	});

	it("rejects zero, negative, and malformed amounts", () => {
		expect(() => transferFormSchema.parse({ ...valid, amount: "0" })).toThrow();
		expect(() =>
			transferFormSchema.parse({ ...valid, amount: "-5" }),
		).toThrow();
		expect(() =>
			transferFormSchema.parse({ ...valid, amount: "12.505" }),
		).toThrow();
	});
});

describe("activityListQuerySchema", () => {
	it("defaults status and pagination and accepts the transfer type", () => {
		expect(activityListQuerySchema.parse({ type: "transfer" })).toMatchObject({
			status: "active",
			type: "transfer",
			page: 1,
			pageSize: 20,
		});
		expect(() => activityListQuerySchema.parse({ type: "nope" })).toThrow();
	});
});
