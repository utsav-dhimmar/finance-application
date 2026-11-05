import type { PreferencesResponse } from "@finance-application/schemas";
import {
	supportedCurrencyCodes,
	updatePreferencesBodySchema,
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
	FieldDescription,
	FieldLabel,
} from "@finance-application/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { useMe } from "@/hooks/use-auth";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { formatMinorUnits } from "@/lib/money";
import { getPreferencesErrorMessage } from "@/services/preferences-service";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

// Select options come from the shared supported-currency union — the same
// list the API validates against. Only INR is initially supported; widening
// the union (with a registry entry) extends this menu without UI changes.
const CURRENCY_OPTIONS = supportedCurrencyCodes.map((code) => ({
	value: code,
	label: code,
}));

interface PreferencesCardProps {
	preferences: PreferencesResponse;
}

function PreferencesCard({ preferences }: PreferencesCardProps) {
	const update = useUpdatePreferences();
	const form = useForm<{
		currencyCode: (typeof supportedCurrencyCodes)[number];
	}>({
		resolver: zodResolver(updatePreferencesBodySchema),
		defaultValues: { currencyCode: preferences.currencyCode },
	});

	// Keep the form in sync when the preference changes elsewhere.
	useEffect(() => {
		form.reset({ currencyCode: preferences.currencyCode });
	}, [preferences.currencyCode, form]);

	const onSubmit = form.handleSubmit((values) => {
		update.mutate(
			{ currencyCode: values.currencyCode },
			{
				onSuccess: (updated) => {
					toast.success(
						`Display currency set to ${updated.currencyCode} (${updated.currencySymbol}).`,
					);
				},
				onError: (error) => {
					toast.error(
						getPreferencesErrorMessage(
							error,
							"Could not save the preference. Is the API running?",
						),
					);
				},
			},
		);
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-semibold tracking-tight text-foreground">
					Currency display
				</CardTitle>
				<CardDescription>
					Choose how monetary amounts are shown. This is display-only: stored
					amounts keep their recorded currency and are never converted.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					<Controller
						name="currencyCode"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="preferences-currency">
									Display currency
								</FieldLabel>
								<Select
									items={CURRENCY_OPTIONS}
									value={field.value}
									onValueChange={(value) => {
										if (value) {
											field.onChange(value);
										}
									}}
								>
									<SelectTrigger id="preferences-currency">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CURRENCY_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldDescription>
									Example amount:{" "}
									<span className="font-mono tabular-nums">
										{formatMinorUnits(125050, {
											symbol: preferences.currencySymbol,
											minorUnitExponent: preferences.minorUnitExponent,
										})}
									</span>{" "}
									— the symbol and decimals come from the currency definition.
								</FieldDescription>
								{fieldState.error && (
									<p role="alert" className="text-sm text-destructive">
										{fieldState.error.message}
									</p>
								)}
							</Field>
						)}
					/>
					<div>
						<Button type="submit" disabled={update.isPending}>
							{update.isPending ? "Saving..." : "Save preference"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export function SettingsPage() {
	const navigate = useNavigate();
	const me = useMe();
	const preferences = usePreferences();

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// settings.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p
					aria-live="polite"
					className="text-sm text-muted-foreground animate-pulse"
				>
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
						Settings
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Application preferences, stored with your account so every device
						sees the same choices.
					</p>
				</div>

				{preferences.isPending ? (
					<Skeleton className="h-56 w-full max-w-xl rounded-xl" />
				) : preferences.isError ? (
					<div
						role="alert"
						className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
					>
						<p className="text-sm font-medium text-destructive">
							Could not load your preferences. Is the API running?
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								preferences.refetch();
							}}
						>
							Retry
						</Button>
					</div>
				) : preferences.data ? (
					<PreferencesCard preferences={preferences.data} />
				) : (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<SettingsIcon aria-hidden="true" className="size-5" />
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							No preferences yet. They will appear here once loaded.
						</p>
					</div>
				)}
			</main>
		</div>
	);
}
