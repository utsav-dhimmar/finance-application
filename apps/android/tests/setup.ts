import { cleanup } from "@testing-library/react-native";
import * as matchers from "@testing-library/react-native/matchers";
import { mockNativeModule } from "vitest-native/helpers";
import { afterEach, expect } from "vitest";

// Register React Native Testing Library's custom matchers on vitest's
// expect and unmount rendered components after every test (vitest does not
// expose global afterEach, so RNTL's automatic cleanup does not trigger).
expect.extend(matchers);

// The @expo/ui components reach their "ExpoUI" native module (Material 3
// palette generation and control constants) at import time; under the test
// engine the module is stubbed here like every other native module. The
// palette roles are only defaults — migrated components pass explicit
// colors from the shared theme, so the stub's values are inert placeholders.
const PALETTE_ROLES = [
	"primary",
	"onPrimary",
	"primaryContainer",
	"onPrimaryContainer",
	"inversePrimary",
	"secondary",
	"onSecondary",
	"secondaryContainer",
	"onSecondaryContainer",
	"tertiary",
	"onTertiary",
	"tertiaryContainer",
	"onTertiaryContainer",
	"background",
	"onBackground",
	"surface",
	"onSurface",
	"surfaceVariant",
	"onSurfaceVariant",
	"surfaceTint",
	"inverseSurface",
	"inverseOnSurface",
	"error",
	"onError",
	"errorContainer",
	"onErrorContainer",
	"outline",
	"outlineVariant",
	"scrim",
	"surfaceBright",
	"surfaceDim",
	"surfaceContainer",
	"surfaceContainerHigh",
	"surfaceContainerHighest",
	"surfaceContainerLow",
	"surfaceContainerLowest",
	"primaryFixed",
	"primaryFixedDim",
	"onPrimaryFixed",
	"onPrimaryFixedVariant",
	"secondaryFixed",
	"secondaryFixedDim",
	"onSecondaryFixed",
	"onSecondaryFixedVariant",
	"tertiaryFixed",
	"tertiaryFixedDim",
	"onTertiaryFixed",
	"onTertiaryFixedVariant",
] as const;

function stubPalette(scheme: "light" | "dark"): Record<string, string> {
	const background = scheme === "dark" ? "#101013FF" : "#FFFFFFFF";
	const onBackground = scheme === "dark" ? "#FFFFFFFF" : "#191A1CFF";
	const primary = scheme === "dark" ? "#B6C4FFFF" : "#3F5AA9FF";
	const onPrimary = scheme === "dark" ? "#223C74FF" : "#FFFFFFFF";
	const palette: Record<string, string> = {};
	for (const role of PALETTE_ROLES) {
		palette[role] =
			role === "background"
				? background
				: role === "onBackground"
					? onBackground
					: role === "primary"
						? primary
						: role === "onPrimary"
							? onPrimary
							: role.startsWith("error")
								? "#BA1A1AFF"
								: onBackground;
	}
	return palette;
}

const EXPO_UI_STUB = {
	getMaterialColors: (options?: { scheme?: "light" | "dark" } | null) =>
		stubPalette(options?.scheme === "dark" ? "dark" : "light"),
	isDynamicColorAvailable: false,
	SwitchDefaultIconSize: 24,
	ToggleButtonIconSize: 18,
	ToggleButtonIconSpacing: 4,
};

// Registered for the TurboModuleRegistry layer first…
mockNativeModule("ExpoUI", EXPO_UI_STUB);

// …but expo-modules-core's requireOptionalNativeModule answers from
// `globalThis.expo.modules` first, where the engine's stub is seeded from the
// installed SDK's module table (its ExpoUI entry is stale — it lists only
// `completeRefresh`/`withAnimation`). Patch those members onto the stub so
// @expo/ui's Host finds the palette it needs at render time.
interface ExpoGlobal {
	modules?: Record<string, Record<string, unknown> | undefined>;
}
const expoGlobal = (globalThis as { expo?: ExpoGlobal }).expo;
const expoUiStub = expoGlobal?.modules?.ExpoUI;
if (expoUiStub) {
	for (const [member, value] of Object.entries(EXPO_UI_STUB)) {
		expoUiStub[member] = value;
	}
}

afterEach(() => {
	cleanup();
});
