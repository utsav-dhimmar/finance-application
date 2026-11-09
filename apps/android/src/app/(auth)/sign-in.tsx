import { useState } from "react";
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

import { useSession } from "@/session/session-context";
import { hairline, spacing, typography, type ThemeColors } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

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
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const inFlight = submitting;
	const canSubmit =
		email.trim().length > 0 && password.length > 0 && !inFlight;
	const failure =
		state.status === "signed-out" && state.error !== undefined
			? state.error
			: null;

	async function handleSubmit(): Promise<void> {
		if (!canSubmit) {
			return;
		}
		setSubmitting(true);
		try {
			await signIn(email.trim(), password);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<SafeAreaView style={styles.screen}>
			<KeyboardAvoidingView behavior="padding" style={styles.body}>
				<Text style={styles.brand}>Finance</Text>
				<Text style={styles.tagline}>Personal finance, one box at a time.</Text>

				<View style={[styles.form, hairline(c.border)]}>
					<Text style={styles.label}>Email</Text>
					<TextInput
						autoCapitalize="none"
						autoComplete="email"
						keyboardType="email-address"
						onChangeText={setEmail}
						style={styles.input}
						value={email}
					/>
					<Text style={styles.label}>Password</Text>
					<TextInput
						autoCapitalize="none"
						onChangeText={setPassword}
						secureTextEntry
						style={styles.input}
						value={password}
					/>
					{failure !== null ? (
						<Text style={styles.failure}>{failure}</Text>
					) : null}
					<Pressable
						disabled={!canSubmit}
						onPress={() => {
							void handleSubmit();
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
