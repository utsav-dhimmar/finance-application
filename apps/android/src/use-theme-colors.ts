import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ThemeColors } from "@/theme";

/** Selects the theme palette from the device's current color scheme. */
export function useThemeColors(): ThemeColors {
	const scheme = useColorScheme();
	return scheme === "dark" ? darkColors : lightColors;
}
