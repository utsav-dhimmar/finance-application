import { Button } from "@finance-application/ui/components/button";
import { ModeToggle } from "@finance-application/ui/components/mode-toggle";
import { Link, useRouter } from "@tanstack/react-router";
import { Menu, Wallet, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useLogout, useMe } from "@/hooks/use-auth";

// Safe link that falls back to standard anchor tag if rendered outside RouterProvider
export function SafeLink({
	to,
	children,
	className,
	activeProps,
	onClick,
	...props
}: {
	to: string;
	children: React.ReactNode;
	className?: string;
	activeProps?: { className?: string };
	onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
	[key: string]: unknown;
}) {
	const router = useRouter({ warn: false });
	if (!router) {
		return (
			<a href={to} className={className} onClick={onClick} {...props}>
				{children}
			</a>
		);
	}
	return (
		<Link
			to={to}
			className={className}
			activeProps={activeProps}
			onClick={onClick}
			{...props}
		>
			{children}
		</Link>
	);
}

// App shell header: brand, navigation, and user session actions.
// Supports both authenticated and unauthenticated states seamlessly across desktop and mobile.
export function AppHeader() {
	const me = useMe();
	const logout = useLogout();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	function handleSignOut() {
		logout.mutate(undefined, {
			onSuccess: () => {
				window.location.assign("/login");
			},
		});
	}

	const isAuthenticated = Boolean(me.data);

	return (
		<header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 px-4 sm:px-6 py-3 backdrop-blur-md">
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between">
				<div className="flex items-center gap-6">
					<SafeLink
						to="/"
						onClick={() => setMobileMenuOpen(false)}
						className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
					>
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
							<Wallet aria-hidden="true" className="size-3.5" />
						</span>
						<span className="truncate">Finance Application</span>
					</SafeLink>
					<nav className="hidden md:flex items-center gap-4 text-sm">
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
								<SafeLink
									to="/categories"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Categories
								</SafeLink>
								<SafeLink
									to="/transactions"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Transactions
								</SafeLink>
								<SafeLink
									to="/archive"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Archive
								</SafeLink>
								<SafeLink
									to="/trash"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Trash
								</SafeLink>
								<SafeLink
									to="/settings"
									className="text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "text-foreground font-medium" }}
								>
									Settings
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
				{/* Desktop session controls */}
				<div className="hidden md:flex items-center gap-3">
					<ModeToggle />
					{me.isPending ? (
						<div className="h-8 w-20 animate-pulse rounded-md bg-muted/50" />
					) : isAuthenticated ? (
						<>
							<span className="font-mono text-xs text-muted-foreground">
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
				{/* Mobile menu trigger and quick theme toggle */}
				<div className="flex md:hidden items-center gap-1">
					<ModeToggle />
					<Button
						variant="ghost"
						size="sm"
						className="size-9 p-0"
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileMenuOpen}
						onClick={() => setMobileMenuOpen((prev) => !prev)}
					>
						{mobileMenuOpen ? (
							<X aria-hidden="true" className="size-5" />
						) : (
							<Menu aria-hidden="true" className="size-5" />
						)}
					</Button>
				</div>
			</div>

			{/* Mobile navigation collapsible overlay */}
			{mobileMenuOpen && (
				<div className="mt-3 border-t border-border/80 pt-3 md:hidden animate-in fade-in-0 duration-150">
					<nav className="flex flex-col gap-1 text-sm">
						{isAuthenticated ? (
							<>
								<SafeLink
									to="/dashboard"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Dashboard
								</SafeLink>
								<SafeLink
									to="/accounts"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Accounts
								</SafeLink>
								<SafeLink
									to="/categories"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Categories
								</SafeLink>
								<SafeLink
									to="/transactions"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Transactions
								</SafeLink>
								<SafeLink
									to="/archive"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Archive
								</SafeLink>
								<SafeLink
									to="/trash"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Trash
								</SafeLink>
								<SafeLink
									to="/settings"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Settings
								</SafeLink>
								<div className="mt-2 border-t border-border/60 pt-3">
									<div className="mb-2 px-3 font-mono text-xs text-muted-foreground truncate">
										{me.data?.email}
									</div>
									<Button
										variant="outline"
										size="sm"
										className="w-full justify-center"
										onClick={() => {
											setMobileMenuOpen(false);
											handleSignOut();
										}}
										disabled={logout.isPending}
									>
										Sign out
									</Button>
								</div>
							</>
						) : (
							<>
								<SafeLink
									to="/"
									onClick={() => setMobileMenuOpen(false)}
									className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									activeProps={{
										className: "text-foreground font-medium bg-muted/60",
									}}
								>
									Home
								</SafeLink>
								<div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
									<SafeLink
										to="/login"
										onClick={() => setMobileMenuOpen(false)}
									>
										<Button
											variant="outline"
											size="sm"
											className="w-full justify-center"
										>
											Sign in
										</Button>
									</SafeLink>
									<SafeLink
										to="/register"
										onClick={() => setMobileMenuOpen(false)}
									>
										<Button
											variant="default"
											size="sm"
											className="w-full justify-center"
										>
											Get started
										</Button>
									</SafeLink>
								</div>
							</>
						)}
					</nav>
				</div>
			)}
		</header>
	);
}
