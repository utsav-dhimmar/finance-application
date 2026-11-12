import { Stack, usePathname, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { BoxyNavigationBar, type SelectOption } from "@/components/ui";
import { useThemeColors } from "@/use-theme-colors";

/** The four core destinations; values are the group-relative route paths. */
const TAB_ITEMS: SelectOption[] = [
	{ value: "/", label: "Dashboard" },
	{ value: "/transactions", label: "Transactions" },
	{ value: "/accounts", label: "Accounts" },
	{ value: "/categories", label: "Categories" },
];

/**
 * The authenticated shell: the app header and the native Compose bottom
 * navigation bar stay mounted on every tab screen. The destinations are
 * declared up front so route names never churn; expo-router keeps owning
 * screen mounting (Stack) while the native bar drives navigation with
 * router.navigate, which pops to an existing entry instead of stacking.
 */
export default function AppLayout() {
	const c = useThemeColors();
	const styles = createStyles();
	const router = useRouter();
	const pathname = usePathname();
	return (
		<View style={[styles.shell, { backgroundColor: c.background }]}>
			<AppHeader />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="index" />
				<Stack.Screen name="transactions" />
				<Stack.Screen name="accounts" />
				<Stack.Screen name="categories" />
			</Stack>
			<BoxyNavigationBar
				items={TAB_ITEMS}
				activeValue={pathname}
				onNavigate={(route) => {
					// The values are the developer-controlled TAB_ITEMS paths,
					// which match the declared Stack screens exactly; expo
					//-router's typed routes just cannot see that from a string.
					router.navigate(route as "/transactions");
				}}
			/>
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
