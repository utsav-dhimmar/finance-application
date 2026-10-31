import type { AccountType } from "@finance-application/schemas";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
	cash: "Cash",
	bank: "Bank",
	wallet: "Wallet",
};
