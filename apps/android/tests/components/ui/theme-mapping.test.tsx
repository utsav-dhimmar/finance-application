import { describe, expect, it } from "vitest";

// The native theme mapping must derive from the shared boxy tokens — the
// android-ui spec's single-source rule now covers the Compose layer too.
import {
	boxyShape,
	composeText,
	destructiveButtonColors,
	fieldColors,
	ghostButtonColors,
	outlineButtonColors,
	primaryButtonColors,
} from "@/components/ui/theme-mapping";
import { darkColors, lightColors } from "@/theme";

describe("boxy theme mapping", () => {
	it("maps the zero-radius rectangle shape", () => {
		// Shape.Rectangle's cornerRounding defaults to 0 — the boxy rule — and
		// the mapping passes no rounding override.
		const shape = boxyShape as { props?: { cornerRounding?: number } };
		expect(shape.props?.cornerRounding ?? 0).toBe(0);
	});

	it("derives button colors from the light tokens", () => {
		expect(primaryButtonColors(lightColors)).toEqual({
			containerColor: lightColors.primary,
			contentColor: lightColors.primaryForeground,
			disabledContainerColor: lightColors.muted,
			disabledContentColor: lightColors.mutedForeground,
		});
		expect(destructiveButtonColors(lightColors)).toEqual({
			containerColor: lightColors.destructive,
			contentColor: lightColors.destructiveForeground,
			disabledContainerColor: lightColors.muted,
			disabledContentColor: lightColors.mutedForeground,
		});
		expect(outlineButtonColors(lightColors).contentColor).toBe(
			lightColors.foreground,
		);
		expect(ghostButtonColors(lightColors).contentColor).toBe(
			lightColors.foreground,
		);
	});

	it("derives button colors from the dark tokens", () => {
		expect(primaryButtonColors(darkColors).containerColor).toBe(
			darkColors.primary,
		);
		expect(destructiveButtonColors(darkColors).containerColor).toBe(
			darkColors.destructive,
		);
	});

	it("derives field colors from the tokens", () => {
		expect(fieldColors(lightColors)).toEqual({
			focusedTextColor: lightColors.foreground,
			unfocusedTextColor: lightColors.foreground,
			disabledTextColor: lightColors.mutedForeground,
			cursorColor: lightColors.primary,
			focusedContainerColor: lightColors.background,
			unfocusedContainerColor: lightColors.background,
			focusedIndicatorColor: lightColors.primary,
			unfocusedIndicatorColor: lightColors.border,
			disabledIndicatorColor: lightColors.mutedForeground,
		});
	});

	it("maps typography sizes from the shared tokens", () => {
		expect(composeText(lightColors.foreground, "title")).toEqual({
			color: lightColors.foreground,
			fontSize: 15,
			fontWeight: "700",
		});
		expect(composeText(lightColors.foreground, "body").fontSize).toBe(13);
		expect(composeText(lightColors.foreground, "label").fontSize).toBe(11);
	});
});
