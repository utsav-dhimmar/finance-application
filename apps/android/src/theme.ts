import type { TextStyle, ViewStyle } from "react-native";

// Visual tokens for the boxy design language, mirroring the web theme's
// palettes (packages/ui/src/styles.css, :root and .dark) converted from
// oklch to hex for React Native. Zero corner radius everywhere: sharp
// corners, flat surfaces, 1px structural borders instead of shadows.
export interface ThemeColors {
	background: string;
	foreground: string;
	muted: string;
	mutedForeground: string;
	border: string;
	primary: string;
	primaryForeground: string;
	destructive: string;
	destructiveForeground: string;
}

export const lightColors: ThemeColors = {
	background: "#FFFFFF",
	foreground: "#0A0A0A",
	muted: "#F5F5F5",
	mutedForeground: "#737373",
	border: "#E5E5E5",
	primary: "#BB4D00",
	primaryForeground: "#FFFBEB",
	destructive: "#E7000B",
	destructiveForeground: "#FFFFFF",
};

export const darkColors: ThemeColors = {
	background: "#0A0A0A",
	foreground: "#FAFAFA",
	muted: "#262626",
	mutedForeground: "#A1A1A1",
	border: "#FFFFFF1A",
	primary: "#973C00",
	primaryForeground: "#FFFBEB",
	destructive: "#FF6467",
	destructiveForeground: "#FAFAFA",
};

export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

export const radius = {
	none: 0,
	button: 0,
	card: 0,
	input: 0,
	sheet: 0,
} as const;

export const typography = {
	sizeXs: 11,
	sizeSm: 13,
	sizeMd: 15,
	sizeLg: 18,
	sizeXl: 22,
	sizeXxl: 28,
	weightRegular: "400",
	weightMedium: "500",
	weightBold: "700",
} as const;

export type StyleToken = ViewStyle | TextStyle;

/** The 1px structural border every boxy surface is built from. */
export function hairline(
	lineColor: string = lightColors.border,
): Pick<ViewStyle, "borderWidth" | "borderColor" | "borderStyle"> {
	return { borderWidth: 1, borderColor: lineColor, borderStyle: "solid" };
}
