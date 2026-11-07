import * as React from "react";

export type Theme = "dark" | "light" | "system";

export interface ThemeProviderProps {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}

export interface ThemeProviderState {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext =
	React.createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "finance-app-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setThemeState] = React.useState<Theme>(() => {
		if (typeof window === "undefined") return defaultTheme;
		try {
			return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
		} catch {
			return defaultTheme;
		}
	});

	React.useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (theme === "system") {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			const systemTheme = mediaQuery.matches ? "dark" : "light";
			root.classList.add(systemTheme);

			const listener = (event: MediaQueryListEvent) => {
				root.classList.remove("light", "dark");
				root.classList.add(event.matches ? "dark" : "light");
			};
			mediaQuery.addEventListener("change", listener);
			return () => mediaQuery.removeEventListener("change", listener);
		}

		root.classList.add(theme);
	}, [theme]);

	const value = React.useMemo(
		() => ({
			theme,
			setTheme: (nextTheme: Theme) => {
				try {
					localStorage.setItem(storageKey, nextTheme);
				} catch {
					// LocalStorage may be blocked in private browsing
				}
				setThemeState(nextTheme);
			},
		}),
		[theme, storageKey],
	);

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export function useTheme(): ThemeProviderState {
	const context = React.useContext(ThemeProviderContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
