import {
	registerBodySchema,
	type RegisterBody,
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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRegister, useMe } from "@/hooks/use-auth";
import { getAuthErrorMessage } from "@/services/auth-service";

export const Route = createFileRoute("/register")({ component: RegisterPage });

export function RegisterPage() {
	const navigate = useNavigate();
	const me = useMe();
	const register = useRegister();
	const form = useForm<RegisterBody>({
		resolver: zodResolver(registerBodySchema),
		defaultValues: { email: "", password: "" },
	});

	// Guard: an authenticated visitor has no business on /register.
	useEffect(() => {
		if (me.data) {
			navigate({ to: "/dashboard" });
		}
	}, [me.data, navigate]);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		register.mutate(values, {
			onSuccess: () => navigate({ to: "/dashboard" }),
			onError: (error) => {
				form.setError("root", {
					message: getAuthErrorMessage(
						error,
						"Registration failed. Is the API running?",
					),
				});
			},
		});
	});

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-8">
			<Card>
				<CardHeader>
					<CardTitle>Create your account</CardTitle>
					<CardDescription>
						Start tracking expenses, income, and budgets in one place.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
						{form.formState.errors.root?.message && (
							<p role="alert" className="text-sm text-destructive">
								{form.formState.errors.root.message}
							</p>
						)}
						<Controller
							name="email"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="email">Email</FieldLabel>
									<Input
										id="email"
										type="email"
										autoComplete="email"
										{...field}
									/>
									{fieldState.error && (
										<FieldError>{fieldState.error.message}</FieldError>
									)}
								</Field>
							)}
						/>
						<Controller
							name="password"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="password">Password</FieldLabel>
									<Input
										id="password"
										type="password"
										autoComplete="new-password"
										{...field}
									/>
									{fieldState.error && (
										<FieldError>{fieldState.error.message}</FieldError>
									)}
								</Field>
							)}
						/>
						<Button type="submit" disabled={register.isPending}>
							{register.isPending ? "Creating account..." : "Register"}
						</Button>
					</form>
					<p className="mt-4 text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link to="/login" className="underline underline-offset-4">
							Log in
						</Link>
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
