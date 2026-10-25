import { Button } from "@finance-application/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

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
	const greeting = useQuery({
		queryKey: ["greeting"],
		queryFn: fetchGreeting,
	});

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-4xl font-bold">Finance Application</h1>
			<Button>
				<Wallet aria-hidden="true" />
				Get started
			</Button>
			{greeting.isPending && <p aria-live="polite">Loading greeting...</p>}
			{greeting.isError && (
				<p role="alert">Greeting unavailable. Is the API running?</p>
			)}
			{greeting.isSuccess && (
				<p aria-live="polite">{greeting.data.messages[0] ?? ""}</p>
			)}
		</main>
	);
}

export const Route = createFileRoute("/")({ component: Home });
