import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

/**
 * The authenticated shell: the app header stays mounted above the bottom tab
 * bar on every tab screen. All four core destinations are declared up front
 * so route names never churn across the remaining screen changes. The
 * Dashboard tab is index.tsx, which Expo Router loads as the default tab.
 */
export default function AppLayout() {
	const c = useThemeColors();
	const styles = createStyles();
	return (
		<View style={[styles.shell, { backgroundColor: c.background }]}>
			<AppHeader />
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarActiveTintColor: c.primary,
					tabBarInactiveTintColor: c.mutedForeground,
					tabBarLabelStyle: {
						fontSize: typography.sizeXs,
						fontWeight: typography.weightMedium,
					},
					tabBarStyle: {
						backgroundColor: c.background,
						borderTopColor: c.border,
						borderTopWidth: 1,
						elevation: 0,
						shadowOpacity: 0,
					},
				}}
			>
				<Tabs.Screen name="index" options={{ title: "Dashboard" }} />
				<Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
				<Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
				<Tabs.Screen name="categories" options={{ title: "Categories" }} />
			</Tabs>
		</View>
	);
}

function createStyles() {
	return StyleSheet.create({
		shell: {
			flex: 1,
		},
	});
}
