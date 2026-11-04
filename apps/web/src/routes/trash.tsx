import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AccountsPanel } from "@/components/archive-trash/accounts-panel";
import { CategoriesPanel } from "@/components/archive-trash/categories-panel";
import {
	RecordTypeTabs,
	type RecordType,
} from "@/components/archive-trash/record-type-tabs";
import { TransactionsPanel } from "@/components/archive-trash/transactions-panel";
import { TransfersPanel } from "@/components/archive-trash/transfers-panel";
import { AppHeader } from "@/components/app-header";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/trash")({ component: TrashPage });

// The unified Trash view: soft-deleted records of every type under
// record-type tabs, each tab composing that entity's existing lifecycle list
// in deleted mode with restore plus per-record permanent deletion behind the
// typed confirmation. Referenced accounts/categories surface the
// PERMANENT_DELETE_BLOCKED conflict with the server's explanatory copy.
export function TrashPage() {
	const navigate = useNavigate();
	const me = useMe();
	const [tab, setTab] = useState<RecordType>("accounts");

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// trashed data.
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
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
						Trash
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Deleted records of every type. Restore them, or remove them for
						good — referenced records refuse permanent deletion to preserve
						financial history.
					</p>
				</div>

				<RecordTypeTabs value={tab} onValueChange={setTab} />

				{tab === "accounts" && <AccountsPanel mode="deleted" />}
				{tab === "categories" && <CategoriesPanel mode="deleted" />}
				{tab === "transactions" && <TransactionsPanel mode="deleted" />}
				{tab === "transfers" && <TransfersPanel mode="deleted" />}
			</main>
		</div>
	);
}
