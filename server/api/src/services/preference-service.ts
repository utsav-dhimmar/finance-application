import type { PreferencesResponse } from "@finance-application/schemas";
import { currencyCodeSchema } from "@finance-application/schemas";
import {
	currencyDefinition,
	DEFAULT_CURRENCY_CODE,
	isSupportedCurrencyCode,
} from "@/lib/currency-registry";
import type { ErrorCode } from "@/lib/error";
import type { PreferenceRepository } from "@/repositories/preference-repository";
import { isoNow } from "@/utils/datetime";

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type PreferenceOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

export type UpdatePreferencesOutcome = PreferenceOutcome<
	PreferencesResponse,
	"UNSUPPORTED_CURRENCY"
>;

function toView(row: { currencyCode: string }): PreferencesResponse {
	// The DB CHECK constraint guarantees the vocabulary; parsing keeps the
	// view type honest without an unsafe cast.
	const code = currencyCodeSchema.parse(row.currencyCode);
	const definition = currencyDefinition(code);
	return {
		currencyCode: code,
		currencySymbol: definition.symbol,
		minorUnitExponent: definition.minorUnitExponent,
	};
}

export interface UpdatePreferencesInput {
	userId: string;
	currencyCode: string;
}

export function createPreferenceService(deps: {
	preferences: PreferenceRepository;
}) {
	const { preferences } = deps;

	return {
		// Reads never surface an empty state: a user with no stored row gets
		// defaults applied, and the default row is written (read-repair) so the
		// preference persists for the next client. Concurrent first reads are
		// conflict-safe — the insert-or-ignore keeps one canonical row.
		async read(userId: string): Promise<PreferencesResponse> {
			const existing = await preferences.findByUserId(userId);
			if (existing) {
				return toView(existing);
			}
			const now = isoNow();
			await preferences.insertOrIgnoreDefault(userId, {
				createdAt: now,
				updatedAt: now,
			});
			const created = await preferences.findByUserId(userId);
			if (!created) {
				// Only reachable on storage failure; the read still answers with
				// the defaults rather than failing the request.
				return toView({ currencyCode: DEFAULT_CURRENCY_CODE });
			}
			return toView(created);
		},

		// Display-only by contract: the update writes the preference row and
		// touches no financial record. The transport schema already narrows to
		// the supported union; this re-check is the service-level defense that
		// yields the meaningful UNSUPPORTED_CURRENCY failure for any caller
		// bypassing the schema.
		async update(
			input: UpdatePreferencesInput,
		): Promise<UpdatePreferencesOutcome> {
			if (!isSupportedCurrencyCode(input.currencyCode)) {
				return { ok: false, code: "UNSUPPORTED_CURRENCY" };
			}
			const now = isoNow();
			const row = await preferences.upsertCurrencyCode(
				input.userId,
				input.currencyCode,
				now,
			);
			return { ok: true, value: toView(row) };
		},
	};
}

export type PreferenceService = ReturnType<typeof createPreferenceService>;
