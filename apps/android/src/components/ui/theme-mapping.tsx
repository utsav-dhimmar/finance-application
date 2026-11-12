import { Shape, type ShapeJSXElement } from "@expo/ui/jetpack-compose";
import type { ButtonColors, TextFieldColors } from "@expo/ui/jetpack-compose";
import { typography, type ThemeColors } from "@/theme";

// Derives the @expo/ui (Jetpack Compose) control theme from the shared boxy
// theme tokens — the native layer's single source of truth, per the android-ui
// spec's "Single theme source" requirement. No palette literals here.

/**
 * The zero-radius rectangle every native control uses. `Shape.Rectangle`'s
 * `cornerRounding` defaults to 0, which IS the boxy rule. Called as a
 * function because the shape factories return the marker-typed JSX element
 * Compose components require.
 */
export const boxyShape: ShapeJSXElement = Shape.Rectangle({});

export type BoxyTextVariant = "title" | "body" | "label" | "caption";

/** Typography mapped from the shared tokens for Compose `Text`. */
export function composeText(
	foreground: string,
	variant: BoxyTextVariant,
): { color: string; fontSize: number; fontWeight: "400" | "500" | "700" } {
	const size = {
		title: typography.sizeMd,
		body: typography.sizeSm,
		label: typography.sizeXs,
		caption: typography.sizeXs,
	}[variant];
	const fontWeight = {
		title: typography.weightBold,
		body: typography.weightRegular,
		label: typography.weightRegular,
		caption: typography.weightRegular,
	}[variant];
	return { color: foreground, fontSize: size, fontWeight };
}

/** Filled button in the theme's primary pairing. */
export function primaryButtonColors(c: ThemeColors): ButtonColors {
	return {
		containerColor: c.primary,
		contentColor: c.primaryForeground,
		disabledContainerColor: c.muted,
		disabledContentColor: c.mutedForeground,
	};
}

/** Filled button in the theme's destructive pairing. */
export function destructiveButtonColors(c: ThemeColors): ButtonColors {
	return {
		containerColor: c.destructive,
		contentColor: c.destructiveForeground,
		disabledContainerColor: c.muted,
		disabledContentColor: c.mutedForeground,
	};
}

/** Outlined button: theme hairline look without a fill. */
export function outlineButtonColors(c: ThemeColors): ButtonColors {
	// "transparent" is structural (no fill), not a palette color.
	return {
		containerColor: "transparent",
		contentColor: c.foreground,
		disabledContainerColor: "transparent",
		disabledContentColor: c.mutedForeground,
	};
}

/** Outlined button with destructive content: the card action row's delete. */
export function outlineDestructiveButtonColors(c: ThemeColors): ButtonColors {
	// "transparent" is structural (no fill), not a palette color.
	return {
		containerColor: "transparent",
		contentColor: c.destructive,
		disabledContainerColor: "transparent",
		disabledContentColor: c.mutedForeground,
	};
}

/** Text-only button. */
export function ghostButtonColors(c: ThemeColors): ButtonColors {
	return { contentColor: c.foreground };
}

/** TextField palette for both focused and unfocused states. */
export function fieldColors(c: ThemeColors): TextFieldColors {
	return {
		focusedTextColor: c.foreground,
		unfocusedTextColor: c.foreground,
		disabledTextColor: c.mutedForeground,
		cursorColor: c.primary,
		focusedContainerColor: c.background,
		unfocusedContainerColor: c.background,
		focusedIndicatorColor: c.primary,
		unfocusedIndicatorColor: c.border,
		disabledIndicatorColor: c.mutedForeground,
	};
}
