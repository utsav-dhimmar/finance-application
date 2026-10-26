import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

export function DashboardPage() {
	const navigate = useNavigate();
	const me = useMe();

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
				<p aria-live="polite">Loading...</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
				<h1 className="text-3xl font-bold">Dashboard</h1>
				<p aria-live="polite">
					Signed in as <strong>{me.data.email}</strong>
				</p>
				<p className="text-sm text-muted-foreground">
					Finance features will live here. This page exists to prove the
					authenticated route works end to end.
				</p>
			</main>
		</div>
	);
}
