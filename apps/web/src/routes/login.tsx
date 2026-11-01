import {
	loginBodySchema,
	type LoginBody,
} from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finance-application/ui/components/card";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@finance-application/ui/components/field";
import { Input } from "@finance-application/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { AppHeader, SafeLink } from "@/components/app-header";
import { useLogin, useMe } from "@/hooks/use-auth";
import { getAuthErrorMessage } from "@/services/auth-service";

export const Route = createFileRoute("/login")({ component: LoginPage });

export function LoginPage() {
	const navigate = useNavigate();
	const me = useMe();
	const login = useLogin();
	const form = useForm<LoginBody>({
		resolver: zodResolver(loginBodySchema),
		defaultValues: { email: "", password: "" },
	});

	// Guard: an authenticated visitor has no business on /login.
	useEffect(() => {
		if (me.data) {
			navigate({ to: "/dashboard" });
		}
	}, [me.data, navigate]);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		login.mutate(values, {
			onSuccess: () => navigate({ to: "/dashboard" }),
			onError: (error) => {
				form.setError("root", {
					message: getAuthErrorMessage(
						error,
						"Login failed. Is the API running?",
					),
				});
			},
		});
	});

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
							Log in
						</CardTitle>
						<CardDescription className="text-xs text-muted-foreground">
							Sign in to track your expenses and budgets.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
							{form.formState.errors.root?.message && (
								<p role="alert" className="text-xs text-destructive">
									{form.formState.errors.root.message}
								</p>
							)}
							<Controller
								name="email"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="email" className="text-xs">
											Email
										</FieldLabel>
										<Input
											id="email"
											type="email"
											autoComplete="email"
											placeholder="you@example.com"
											className="h-9 text-sm"
											{...field}
										/>
										{fieldState.error && (
											<FieldError className="text-xs">
												{fieldState.error.message}
											</FieldError>
										)}
									</Field>
								)}
							/>
							<Controller
								name="password"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="password" className="text-xs">
											Password
										</FieldLabel>
										<Input
											id="password"
											type="password"
											autoComplete="current-password"
											placeholder="••••••••"
											className="h-9 text-sm"
											{...field}
										/>
										{fieldState.error && (
											<FieldError className="text-xs">
												{fieldState.error.message}
											</FieldError>
										)}
									</Field>
								)}
							/>
							<Button
								type="submit"
								className="mt-1 h-9 shadow-xs"
								disabled={login.isPending}
							>
								{login.isPending ? "Logging in..." : "Log in"}
							</Button>
						</form>
						<p className="mt-4 text-center text-xs text-muted-foreground">
							No account yet?{" "}
							<SafeLink
								to="/register"
								className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
							>
								Register
							</SafeLink>
						</p>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
