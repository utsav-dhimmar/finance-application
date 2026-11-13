import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";

import { queryClient } from "@/lib/query-client";
import { SessionProvider, useSession } from "@/session/session-context";
import type { ThemeColors } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

function createLoadingStyles(c: ThemeColors) {
	return StyleSheet.create({
		center: {
			alignItems: "center",
			backgroundColor: c.background,
			flex: 1,
			justifyContent: "center",
		},
	});
}

function LoadingView() {
	const c = useThemeColors();
	const styles = createLoadingStyles(c);
	return (
		<View style={styles.center}>
			<ActivityIndicator color={c.primary} size="large" />
		</View>
	);
}

/**
 * Session gate: nothing renders while the session is being restored, and
 * route-group guards keep protected screens off the stack while signed out.
 */
function SessionGate() {
	const { state } = useSession();
	if (state.status === "restoring") {
		return <LoadingView />;
	}
	const signedIn = state.status === "signed-in";
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={signedIn}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
		</Stack>
	);
}

export default function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<SessionProvider>
				<SafeAreaProvider>
					{/* "auto" follows the device color scheme. */}
					<StatusBar style="auto" />
					<SessionGate />
					<Toaster position="top-center" />
				</SafeAreaProvider>
			</SessionProvider>
		</QueryClientProvider>
	);
}
