import { Button } from "@finance-application/ui/components/button";
import { Link, useRouter } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import type React from "react";
import { useLogout, useMe } from "@/hooks/use-auth";

// Safe link that falls back to standard anchor tag if rendered outside RouterProvider
export function SafeLink({
	to,
	children,
	className,
	activeProps,
	...props
}: {
	to: string;
	children: React.ReactNode;
	className?: string;
	activeProps?: { className?: string };
	[key: string]: unknown;
}) {
	const router = useRouter({ warn: false });
	if (!router) {
		return (
			<a href={to} className={className} {...props}>
				{children}
			</a>
		);
	}
	return (
		<Link to={to} className={className} activeProps={activeProps} {...props}>
			{children}
		</Link>
	);
}

// App shell header: brand, navigation, and user session actions.
// Supports both authenticated and unauthenticated states seamlessly.
export function AppHeader() {
	const me = useMe();
	const logout = useLogout();

	function handleSignOut() {
		logout.mutate(undefined, {
			onSuccess: () => {
				window.location.assign("/login");
			},
		});
	}

	const isAuthenticated = Boolean(me.data);

	return (
		<header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 px-6 py-3 backdrop-blur-md">
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between">
				<div className="flex items-center gap-6">
					<SafeLink
						to="/"
						className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
					>
						<span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
							<Wallet aria-hidden="true" className="size-3.5" />
						</span>
						Finance Application
					</SafeLink>
					<nav className="flex items-center gap-4 text-sm">
						{isAuthenticated ? (
							<>
								<SafeLink
									to="/dashboard"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Dashboard
								</SafeLink>
								<SafeLink
									to="/accounts"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Accounts
								</SafeLink>
							</>
						) : (
							<SafeLink
								to="/"
								className="text-muted-foreground transition-colors hover:text-foreground"
								activeProps={{ className: "text-foreground font-medium" }}
							>
								Home
							</SafeLink>
						)}
					</nav>
				</div>
				<div className="flex items-center gap-3">
					{me.isPending ? (
						<div className="h-8 w-20 animate-pulse rounded-md bg-muted/50" />
					) : isAuthenticated ? (
						<>
							<span className="hidden font-mono text-xs text-muted-foreground sm:inline-block">
								{me.data?.email}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={handleSignOut}
								disabled={logout.isPending}
							>
								Sign out
							</Button>
						</>
					) : (
						<div className="flex items-center gap-2">
							<SafeLink to="/login">
								<Button variant="ghost" size="sm">
									Sign in
								</Button>
							</SafeLink>
							<SafeLink to="/register">
								<Button variant="default" size="sm">
									Get started
								</Button>
							</SafeLink>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
