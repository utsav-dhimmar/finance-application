import { loginBodySchema } from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { z } from "zod";

import { BoxyButton, BoxyTextField } from "@/components/ui";
import { useSession } from "@/session/session-context";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

// Form state is the schema's input type; submitted values are its parsed
// output type — the same useForm<Input, unknown, Output> shape the web uses.
type LoginInput = z.input<typeof loginBodySchema>;
type LoginOutput = z.output<typeof loginBodySchema>;

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		body: {
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
		},
		brand: {
			color: c.foreground,
			fontSize: typography.sizeXxl,
			fontWeight: typography.weightBold,
		},
		failure: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		form: {
			backgroundColor: c.background,
			gap: spacing.md,
			marginTop: spacing.xl,
			padding: spacing.lg,
		},
		screen: {
			backgroundColor: c.background,
			flex: 1,
		},
		tagline: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.xs,
		},
	});
}

export default function SignIn() {
	const c = useThemeColors();
	const styles = createStyles(c);
	const { state, signIn } = useSession();
	const form = useForm<LoginInput, unknown, LoginOutput>({
		resolver: zodResolver(loginBodySchema),
		defaultValues: { email: "", password: "" },
	});
	const email = form.watch("email");
	const password = form.watch("password");

	const inFlight = form.formState.isSubmitting;
	const canSubmit = email.trim().length > 0 && password.length > 0 && !inFlight;
	const failure =
		state.status === "signed-out" && state.error !== undefined
			? state.error
			: null;

	const onSubmit = form.handleSubmit(async (values: LoginOutput) => {
		await signIn(values.email, values.password);
	});

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.body}>
				<Text style={styles.brand}>Finance</Text>
				<Text style={styles.tagline}>Personal finance, one box at a time.</Text>

				<View style={[styles.form, hairline(c.border)]}>
					<Controller
						control={form.control}
						name="email"
						render={({ field, fieldState }) => (
							<BoxyTextField
								label="Email"
								keyboardType="email"
								onChangeText={field.onChange}
								value={field.value}
								error={fieldState.error?.message ?? null}
							/>
						)}
					/>
					<Controller
						control={form.control}
						name="password"
						render={({ field, fieldState }) => (
							<BoxyTextField
								label="Password"
								secure
								onChangeText={field.onChange}
								value={field.value}
								error={fieldState.error?.message ?? null}
							/>
						)}
					/>
					{failure !== null ? (
						<Text style={styles.failure}>{failure}</Text>
					) : null}
					<BoxyButton
						label="Sign in"
						onPress={() => {
							void onSubmit();
						}}
						disabled={!canSubmit}
						pending={inFlight}
					/>
				</View>
			</View>
		</SafeAreaView>
	);
}
