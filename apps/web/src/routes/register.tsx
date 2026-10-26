import { Button } from "@finance-application/ui/components/button";
import { Input } from "@finance-application/ui/components/input";
import { Label } from "@finance-application/ui/components/label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useMe, useRegister } from "@/lib/auth";

export const Route = createFileRoute("/register")({ component: RegisterPage });

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function RegisterPage() {
	const navigate = useNavigate();
	const me = useMe();
	const register = useRegister();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);

	// Guard: an authenticated visitor has no business on /register.
	useEffect(() => {
		if (me.data) {
			navigate({ to: "/dashboard" });
		}
	}, [me.data, navigate]);

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setServerError(null);
		if (!EMAIL_PATTERN.test(email)) {
			setFieldError("Enter a valid email address.");
			return;
		}
		if (password.length < 8) {
			setFieldError("Password must be at least 8 characters.");
			return;
		}
		setFieldError(null);
		register.mutate(
			{ email, password },
			{
				onSuccess: () => navigate({ to: "/dashboard" }),
				onError: (error) => {
					if (error instanceof ApiError) {
						setServerError(
							error.code === "EMAIL_TAKEN"
								? "That email is already registered. Try logging in instead."
								: error.message,
						);
					} else {
						setServerError("Registration failed. Is the API running?");
					}
				},
			},
		);
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-8">
			<h1 className="text-3xl font-bold">Create your account</h1>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
				{fieldError && (
					<p role="alert" className="text-sm text-destructive">
						{fieldError}
					</p>
				)}
				{serverError && (
					<p role="alert" className="text-sm text-destructive">
						{serverError}
					</p>
				)}
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						autoComplete="email"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						autoComplete="new-password"
					/>
				</div>
				<Button type="submit" disabled={register.isPending}>
					{register.isPending ? "Creating account..." : "Register"}
				</Button>
			</form>
			<p className="text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link to="/login" className="underline underline-offset-4">
					Log in
				</Link>
			</p>
		</main>
	);
}
