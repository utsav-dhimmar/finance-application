import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { CircleSlash, Wallet } from "lucide-react";
import { AppHeader, SafeLink } from "@/components/app-header";

export const Route = createFileRoute("/register")({ component: RegisterPage });

// Registration is permanently closed (single-user product): the page offers
// no form, only the closed notice and the way back to /login.
export function RegisterPage() {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex flex-1 w-full max-w-sm flex-col justify-center px-4 py-12">
				<Card className="border-border/80 shadow-xs">
					<CardHeader className="space-y-1.5 pb-4">
						<div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
							<Wallet aria-hidden="true" className="size-4" />
						</div>
						<CardTitle className="text-xl font-semibold tracking-tight text-foreground">
							Registration is closed
						</CardTitle>
						<CardDescription className="text-xs text-muted-foreground">
							This application is single-user and new registrations are not
							accepted.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col items-start gap-4">
						<p className="flex items-center gap-2 text-xs text-muted-foreground">
							<CircleSlash aria-hidden="true" className="size-4" />
							If you own this application, sign in with your account instead.
						</p>
						<SafeLink
							to="/login"
							className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
						>
							Go to log in
						</SafeLink>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
