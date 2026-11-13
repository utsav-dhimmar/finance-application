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
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

/**
 * The authenticated shell's persistent header: brand, signed-in email, and
 * the sign-out control (the mobile home of the web header's session
 * actions). It sits above the tab navigator in (app)/_layout.tsx, so it
 * stays mounted across every tab screen.
 */
export function AppHeader() {
	const c = useThemeColors();
	const styles = createStyles(c);
	const { state, signOut } = useSession();
	const [signingOut, setSigningOut] = useState(false);

	if (state.status !== "signed-in") {
		// The root session gate keeps these routes mounted only while signed in.
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
		<SafeAreaView edges={["top"]} style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.brand}>Finance</Text>
				<View style={styles.session}>
					<Text numberOfLines={1} style={styles.email}>
						{state.user.email}
					</Text>
					<Pressable
						accessibilityLabel="Sign out"
						accessibilityRole="button"
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
							<ActivityIndicator color={c.foreground} size="small" />
						) : (
							<Text style={styles.signOutText}>Sign out</Text>
						)}
					</Pressable>
				</View>
			</View>
		</SafeAreaView>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		brand: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
		},
		email: {
			color: c.mutedForeground,
			flexShrink: 1,
			fontSize: typography.sizeXs,
		},
		header: {
			alignItems: "center",
			backgroundColor: c.background,
			borderBottomWidth: 1,
			borderColor: c.border,
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
			padding: spacing.lg,
		},
		screen: {
			backgroundColor: c.background,
		},
		session: {
			alignItems: "center",
			flexDirection: "row",
			flexShrink: 1,
			gap: spacing.md,
		},
		signOut: {
			...hairline(c.border),
			alignItems: "center",
			borderRadius: 0,
			padding: spacing.sm,
		},
		signOutDisabled: {
			opacity: 0.5,
		},
		signOutPressed: {
			backgroundColor: c.muted,
		},
		signOutText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
	});
}
