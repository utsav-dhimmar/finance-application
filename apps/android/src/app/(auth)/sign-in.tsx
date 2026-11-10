import { loginBodySchema } from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { z } from "zod";

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
		error: {
			color: c.destructive,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		failure: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		form: {
			backgroundColor: c.background,
			gap: spacing.sm,
			marginTop: spacing.xl,
			padding: spacing.lg,
		},
		input: {
			...hairline(c.border),
			color: c.foreground,
			fontSize: typography.sizeMd,
			padding: spacing.md,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
			textTransform: "uppercase",
		},
		screen: {
			backgroundColor: c.background,
			flex: 1,
		},
		submit: {
			alignItems: "center",
			backgroundColor: c.primary,
			marginTop: spacing.lg,
			padding: spacing.md,
		},
		submitDisabled: {
			opacity: 0.5,
		},
		submitPressed: {
			opacity: 0.9,
		},
		submitText: {
			color: c.primaryForeground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightMedium,
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
			<KeyboardAvoidingView behavior="padding" style={styles.body}>
				<Text style={styles.brand}>Finance</Text>
				<Text style={styles.tagline}>Personal finance, one box at a time.</Text>

				<View style={[styles.form, hairline(c.border)]}>
					<Text style={styles.label}>Email</Text>
					<Controller
						control={form.control}
						name="email"
						render={({ field, fieldState }) => (
							<>
								<TextInput
									accessibilityLabel="Email"
									autoCapitalize="none"
									autoComplete="email"
									keyboardType="email-address"
									onBlur={field.onBlur}
									onChangeText={field.onChange}
									style={styles.input}
									value={field.value}
								/>
								{fieldState.error ? (
									<Text style={styles.error}>{fieldState.error.message}</Text>
								) : null}
							</>
						)}
					/>
					<Text style={styles.label}>Password</Text>
					<Controller
						control={form.control}
						name="password"
						render={({ field, fieldState }) => (
							<>
								<TextInput
									accessibilityLabel="Password"
									autoCapitalize="none"
									onChangeText={field.onChange}
									onBlur={field.onBlur}
									secureTextEntry
									style={styles.input}
									value={field.value}
								/>
								{fieldState.error ? (
									<Text style={styles.error}>{fieldState.error.message}</Text>
								) : null}
							</>
						)}
					/>
					{failure !== null ? (
						<Text style={styles.failure}>{failure}</Text>
					) : null}
					<Pressable
						accessibilityRole="button"
						disabled={!canSubmit}
						onPress={() => {
							void onSubmit();
						}}
						style={({ pressed }) => [
							styles.submit,
							!canSubmit && styles.submitDisabled,
							pressed && canSubmit && styles.submitPressed,
						]}
					>
						{inFlight ? (
							<ActivityIndicator color={c.primaryForeground} />
						) : (
							<Text style={styles.submitText}>Sign in</Text>
						)}
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
