import { NativeTabs } from "expo-router/native-tabs";
import { View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { useThemeColors } from "@/use-theme-colors";

// Theme-independent shell layout; the tab bar's chrome comes from the
// platform navigator itself.
const styles = { shell: { flex: 1 } };

/**
 * The authenticated shell: the app header stays mounted above the native
 * tab bar on every tab screen. All four core destinations are declared up
 * front so route names never churn across the remaining screen changes. The
 * Dashboard tab is index.tsx, which Expo Router loads as the default tab.
 * NativeTabs is Expo Router's native tab bar for the SDK 58 navigation
 * runtime — platform UI on Android (Material bar, Material Symbols icons),
 * exempt from the boxy theme; only the active tint follows the app palette.
 */
export default function AppLayout() {
	const c = useThemeColors();
	return (
		<View style={[styles.shell, { backgroundColor: c.background }]}>
			<AppHeader />
			<NativeTabs tintColor={c.primary}>
				<NativeTabs.Trigger name="index">
					{/* Trigger.Label is the platform's native label element; its raw
					text is the documented usage, not a missing <Text> wrapper. */}
					{/* biome-ignore lint/correctness/noReactNativeRawText: native label element */}
					<NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon md="dashboard" />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="transactions">
					{/* biome-ignore lint/correctness/noReactNativeRawText: native label element */}
					<NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon md="receipt_long" />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="accounts">
					{/* biome-ignore lint/correctness/noReactNativeRawText: native label element */}
					<NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon md="account_balance" />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="categories">
					{/* biome-ignore lint/correctness/noReactNativeRawText: native label element */}
					<NativeTabs.Trigger.Label>Categories</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon md="category" />
				</NativeTabs.Trigger>
			</NativeTabs>
		</View>
	);
}
