import { describe, expect, it, vi } from "vitest";
import type { UserPreferences } from "@/db/schema";
import { createPreferenceService } from "@/services/preference-service";

// Fake of the repository interface: service rules are tested here without a
// database; the real repository's SQL behavior is covered by the route
// contract tests against the workers pool.
function createFakePreferenceRepo() {
	const rows = new Map<string, UserPreferences>();
	function row(overrides: Partial<UserPreferences> & { userId: string }) {
		return {
			currencyCode: "INR",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		} as UserPreferences;
	}
	return {
		rows,
		findByUserId: vi.fn(async (userId: string) => rows.get(userId)),
		insertOrIgnoreDefault: vi.fn(
			async (
				userId: string,
				timestamps: { createdAt: string; updatedAt: string },
			) => {
				if (rows.has(userId)) {
					return;
				}
				rows.set(userId, row({ userId, ...timestamps }));
			},
		),
		upsertCurrencyCode: vi.fn(
			async (userId: string, currencyCode: string, updatedAt: string) => {
				const existing = rows.get(userId);
				const next = row({
					userId,
					currencyCode,
					createdAt: existing?.createdAt ?? updatedAt,
					updatedAt,
				});
				rows.set(userId, next);
				return next;
			},
		),
	};
}

describe("preference service", () => {
	it("read applies defaults and lazily creates exactly one row", async () => {
		const repo = createFakePreferenceRepo();
		const service = createPreferenceService({ preferences: repo });

		const view = await service.read("user-1");
		expect(view).toEqual({
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});
		expect(repo.rows.size).toBe(1);
		expect(repo.rows.get("user-1")?.currencyCode).toBe("INR");

		// A second read keeps a single row and resolves the same definition.
		const again = await service.read("user-1");
		expect(again).toEqual(view);
		expect(repo.rows.size).toBe(1);
	});

	it("read falls back to defaults without failing when the repaired row is unreadable", async () => {
		const repo = createFakePreferenceRepo();
		repo.findByUserId.mockResolvedValue(undefined);
		const service = createPreferenceService({ preferences: repo });

		const view = await service.read("user-1");
		expect(view.currencyCode).toBe("INR");
		expect(view.currencySymbol).toBe("₹");
		expect(view.minorUnitExponent).toBe(2);
	});

	it("update persists a supported code and resolves the registry metadata", async () => {
		const repo = createFakePreferenceRepo();
		const service = createPreferenceService({ preferences: repo });
		// A first-ever PATCH also creates the row (upsert path).
		const view = await service.update({
			userId: "user-1",
			currencyCode: "INR",
		});
		expect(view.ok).toBe(true);
		if (view.ok) {
			expect(view.value).toEqual({
				currencyCode: "INR",
				currencySymbol: "₹",
				minorUnitExponent: 2,
			});
		}
		expect(repo.rows.get("user-1")?.currencyCode).toBe("INR");
	});

	it.each(["USD", "EUR", "inr", ""])(
		"update rejects unsupported code %s with UNSUPPORTED_CURRENCY",
		async (code) => {
			const repo = createFakePreferenceRepo();
			const service = createPreferenceService({ preferences: repo });

			const outcome = await service.update({
				userId: "user-1",
				currencyCode: code,
			});
			expect(outcome).toEqual({ ok: false, code: "UNSUPPORTED_CURRENCY" });
			expect(repo.rows.size).toBe(0);
		},
	);
});
