import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "@finance-application/ui/components/sonner";

import appCss from "../styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Finance Application",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

export function NotFound() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
			<span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				404 Error
			</span>
			<h1 className="text-3xl font-semibold tracking-tight text-foreground">
				Page not found
			</h1>
			<p className="max-w-sm text-sm text-muted-foreground">
				The page you are looking for does not exist.
			</p>
			<a
				href="/"
				className="mt-2 inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
			>
				Return home
			</a>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { queryClient } = Route.useRouteContext();
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/10 selection:text-primary">
				<QueryClientProvider client={queryClient}>
					{children}
					<Toaster position="bottom-right" richColors />
				</QueryClientProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
