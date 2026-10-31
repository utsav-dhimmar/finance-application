import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, CreditCard, Plus, Wallet } from "lucide-react";
import { useEffect } from "react";
import { AppHeader, SafeLink } from "@/components/app-header";
import { useAccounts } from "@/hooks/use-accounts";
import { useMe } from "@/hooks/use-auth";
import { formatPaise } from "@/lib/money";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

export function DashboardPage() {
	const navigate = useNavigate();
	const me = useMe();
	const accounts = useAccounts("active");

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// dashboard content.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p aria-live="polite" className="text-sm text-muted-foreground animate-pulse">
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	const activeAccounts = accounts.data?.accounts ?? [];
	const combinedBalance = accounts.data?.combinedBalanceMinor ?? 0;
	const hasAccounts = activeAccounts.length > 0;

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6 md:p-8">
				{/* Top greeting & status */}
				<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Dashboard
						</h1>
						<p aria-live="polite" className="text-sm text-muted-foreground">
							Signed in as <strong className="font-medium text-foreground">{me.data.email}</strong>
						</p>
					</div>
					<div className="flex items-center gap-2 pt-2 sm:pt-0">
						<SafeLink to="/accounts">
							<Button size="sm" className="gap-1.5 shadow-xs">
								<Plus aria-hidden="true" className="size-3.5" />
								Manage Accounts
							</Button>
						</SafeLink>
					</div>
				</div>

				{/* Financial Summary Metric Cards */}
				{accounts.isPending ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-32 w-full rounded-xl" />
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{/* Net Balance Card */}
						<Card className="p-5">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Total Active Balance
								</CardTitle>
								<div className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
									<Wallet aria-hidden="true" className="size-3.5" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl tabular-nums">
									{formatPaise(combinedBalance)}
								</div>
								<CardDescription className="mt-1 text-xs text-muted-foreground">
									{hasAccounts
										? `Combined across ${activeAccounts.length} active ${
												activeAccounts.length === 1 ? "account" : "accounts"
										  }`
										: "No active accounts configured"}
								</CardDescription>
							</CardContent>
						</Card>

						{/* Active Accounts Count Card */}
						<Card className="p-5">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Active Accounts
								</CardTitle>
								<div className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
									<CreditCard aria-hidden="true" className="size-3.5" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl tabular-nums">
									{activeAccounts.length}
								</div>
								<CardDescription className="mt-1 text-xs text-muted-foreground">
									{hasAccounts ? "Ready for transactions" : "Add an account to begin"}
								</CardDescription>
							</CardContent>
						</Card>

						{/* Quick Navigation Card */}
						<Card className="flex flex-col justify-between p-5">
							<div>
								<div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Account Overview
								</div>
								<p className="mt-2 text-xs text-muted-foreground">
									Review balances, modify lifecycle states, or restore archived accounts.
								</p>
							</div>
							<div className="mt-4">
								<SafeLink to="/accounts">
									<Button variant="outline" size="sm" className="w-full justify-between">
										<span>View all accounts</span>
										<ArrowUpRight aria-hidden="true" className="size-3.5" />
									</Button>
								</SafeLink>
							</div>
						</Card>
					</div>
				)}

				{/* Empty State when zero accounts exist */}
				{!accounts.isPending && !hasAccounts && (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-8 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<CreditCard aria-hidden="true" className="size-5" />
						</div>
						<h2 className="mt-3 text-base font-semibold tracking-tight text-foreground">
							No accounts added yet
						</h2>
						<p className="mt-1 max-w-sm text-xs text-muted-foreground">
							Create your first checking, savings, credit, or cash account to begin tracking balances.
						</p>
						<SafeLink to="/accounts" className="mt-4">
							<Button size="sm">Add your first account</Button>
						</SafeLink>
					</div>
				)}

				{/* Contract Note */}
				<div className="rounded-lg border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
					<p>
						Finance features will live here. This page exists to prove the
						authenticated route works end to end.
					</p>
				</div>
			</main>
		</div>
	);
}
