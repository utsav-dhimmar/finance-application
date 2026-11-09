import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "@/session/session-context";
import { hairline, spacing, typography, type ThemeColors } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		brand: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
		},
		card: {
			backgroundColor: c.background,
			gap: spacing.xs,
			padding: spacing.lg,
		},
		email: {
			color: c.foreground,
			fontSize: typography.sizeMd,
		},
		header: {
			borderBottomWidth: 1,
			borderColor: c.border,
			padding: spacing.lg,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			textTransform: "uppercase",
		},
		screen: {
			backgroundColor: c.background,
			flex: 1,
			gap: spacing.lg,
		},
		signOut: {
			alignItems: "center",
			borderColor: c.foreground,
			borderRadius: 0,
			borderWidth: 1,
			marginTop: spacing.md,
			padding: spacing.md,
		},
		signOutDisabled: {
			opacity: 0.5,
		},
		signOutPressed: {
			backgroundColor: c.muted,
		},
		signOutText: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightMedium,
		},
	});
}

export default function Home() {
	const c = useThemeColors();
	const styles = createStyles(c);
	const { state, signOut } = useSession();
	const [signingOut, setSigningOut] = useState(false);

	if (state.status !== "signed-in") {
		// The root session gate keeps this route mounted only while signed in.
		return null;
	}

	async function handleSignOut(): Promise<void> {
		setSigningOut(true);
		try {
			await signOut();
		} finally {
			setSigningOut(false);
		}
	}

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.brand}>Finance</Text>
			</View>
			<View style={[styles.card, hairline(c.border)]}>
				<Text style={styles.label}>Signed in as</Text>
				<Text style={styles.email}>{state.user.email}</Text>
				<Pressable
					disabled={signingOut}
					onPress={() => {
						void handleSignOut();
					}}
					style={({ pressed }) => [
						styles.signOut,
						signingOut && styles.signOutDisabled,
						pressed && !signingOut && styles.signOutPressed,
					]}
				>
					{signingOut ? (
						<ActivityIndicator color={c.foreground} />
					) : (
						<Text style={styles.signOutText}>Sign out</Text>
					)}
				</Pressable>
			</View>
		</SafeAreaView>
	);
}
