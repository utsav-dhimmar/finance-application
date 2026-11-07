import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AccountsPanel } from "@/components/archive-trash/accounts-panel";
import { CategoriesPanel } from "@/components/archive-trash/categories-panel";
import {
	type RecordType,
	RecordTypeTabs,
} from "@/components/archive-trash/record-type-tabs";
import { TransactionsPanel } from "@/components/archive-trash/transactions-panel";
import { TransfersPanel } from "@/components/archive-trash/transfers-panel";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/archive")({ component: ArchivePage });

// The unified Archive view: archived records of every type under record-type
// tabs, each tab composing that entity's existing lifecycle list in archived
// mode. Only the active tab's panel is mounted; its query is cached, so
// revisits are instant.
export function ArchivePage() {
	const navigate = useNavigate();
	const me = useMe();
	const [tab, setTab] = useState<RecordType>("accounts");

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// archived data.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p
					aria-live="polite"
					className="text-sm text-muted-foreground animate-pulse"
				>
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
						Archive
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Archived records of every type. They stay out of ordinary lists,
						balances, and reports until you restore them.
					</p>
				</div>

				<RecordTypeTabs value={tab} onValueChange={setTab} />

				{tab === "accounts" && <AccountsPanel mode="archived" />}
				{tab === "categories" && <CategoriesPanel mode="archived" />}
				{tab === "transactions" && <TransactionsPanel mode="archived" />}
				{tab === "transfers" && <TransfersPanel mode="archived" />}
			</main>
		</div>
	);
}
