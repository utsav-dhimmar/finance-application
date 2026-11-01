import { Button } from "@finance-application/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	Coins,
	ShieldCheck,
	Sparkles,
	Wallet,
} from "lucide-react";
import { AppHeader, SafeLink } from "@/components/app-header";
import { useMe } from "@/hooks/use-auth";

// Relative on purpose: works in dev through the Vite proxy and in any
// production deployment without hardcoded hosts.
const GREETING_PATH = "/api/greet/utsav?greeting=Hello&times=1";

interface GreetResponse {
	messages: string[];
}

function isGreetResponse(value: unknown): value is GreetResponse {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const messages = (value as Record<string, unknown>).messages;
	return (
		Array.isArray(messages) && messages.every((m) => typeof m === "string")
	);
}

async function fetchGreeting(): Promise<GreetResponse> {
	const res = await fetch(GREETING_PATH);
	if (!res.ok) {
		throw new Error(`Greeting request failed with status ${res.status}`);
	}
	const body: unknown = await res.json();
	if (!isGreetResponse(body)) {
		throw new Error("Greeting response had an unexpected shape");
	}
	return body;
}

export function Home() {
	const me = useMe();
	const greeting = useQuery({
		queryKey: ["greeting"],
		queryFn: fetchGreeting,
	});

	const isAuthenticated = Boolean(me.data);

	return (
		<div className="flex min-h-screen flex-col">
			<AppHeader />

			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
				{/* Minimalist badge */}
				<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-xs">
					<Sparkles aria-hidden="true" className="size-3 text-foreground" />
					<span>Personal finance, simplified & precise</span>
				</div>

				{/* Primary Headline */}
				<h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
					Finance Application
				</h1>

				{/* Value Proposition */}
				<p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
					A calm, deliberate tool for tracking accounts, balances, and budgets
					with zero clutter and exact minor-unit financial integrity.
				</p>

				{/* Call to Action Actions */}
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					{isAuthenticated ? (
						<SafeLink to="/dashboard">
							<Button size="lg" className="h-10 px-5 text-sm font-medium">
								Go to Dashboard
								<ArrowRight aria-hidden="true" className="size-4" />
							</Button>
						</SafeLink>
					) : (
						<>
							<SafeLink to="/register">
								<Button size="lg" className="h-10 px-5 text-sm font-medium">
									<Wallet aria-hidden="true" />
									Get started
								</Button>
							</SafeLink>
							<SafeLink to="/login">
								<Button
									variant="outline"
									size="lg"
									className="h-10 px-5 text-sm font-medium"
								>
									Sign in
								</Button>
							</SafeLink>
						</>
					)}
				</div>

				{/* Feature Highlights Grid */}
				<div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
					<div className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
						<div className="mb-2.5 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
							<Coins aria-hidden="true" className="size-4" />
						</div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Exact Minor Units
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Paise-level financial arithmetic eliminating floating-point errors.
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
						<div className="mb-2.5 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
							<ShieldCheck aria-hidden="true" className="size-4" />
						</div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Audit & Integrity
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Server-enforced lifecycle transitions, unique constraints, and
							safe soft-delete.
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
						<div className="mb-2.5 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
							<CheckCircle2 aria-hidden="true" className="size-4" />
						</div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Zero Clutter
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Minimalist interface designed for quick reviews and focused money
							decisions.
						</p>
					</div>
				</div>

				{/* Understated API Readiness Indicator */}
				<div className="mt-12 text-xs text-muted-foreground">
					{greeting.isPending && (
						<p aria-live="polite" className="animate-pulse">
							Loading greeting...
						</p>
					)}
					{greeting.isError && (
						<p role="alert" className="text-destructive">
							Greeting unavailable. Is the API running?
						</p>
					)}
					{greeting.isSuccess && (
						<p
							aria-live="polite"
							className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono"
						>
							<span className="size-1.5 rounded-full bg-emerald-500" />
							{greeting.data.messages[0] ?? ""}
						</p>
					)}
				</div>
			</main>
		</div>
	);
}

export const Route = createFileRoute("/")({ component: Home });
