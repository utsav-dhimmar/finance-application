import { Button } from "@finance-application/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { useLogout, useMe } from "@/hooks/use-auth";

// App shell header: brand, the signed-in user's email, and Sign out.
// Hidden entirely while the session state is unknown or unauthenticated.
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

	if (!me.data) {
		return null;
	}

	return (
		<header className="flex items-center justify-between border-b border-border px-6 py-3">
			<Link to="/" className="flex items-center gap-2 font-semibold">
				<Wallet aria-hidden="true" className="size-4" />
				Finance Application
			</Link>
			<div className="flex items-center gap-3">
				<span className="text-sm text-muted-foreground">{me.data.email}</span>
				<Button
					variant="outline"
					onClick={handleSignOut}
					disabled={logout.isPending}
				>
					Sign out
				</Button>
			</div>
		</header>
	);
}
