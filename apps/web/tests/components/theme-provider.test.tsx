import { ModeToggle } from "@finance-application/ui/components/mode-toggle";
import {
	ThemeProvider,
	useTheme,
} from "@finance-application/ui/components/theme-provider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function TestConsumer() {
	const { theme, setTheme } = useTheme();
	return (
		<div>
			<span data-testid="current-theme">{theme}</span>
			<button type="button" onClick={() => setTheme("dark")}>
				Set Dark
			</button>
			<button type="button" onClick={() => setTheme("light")}>
				Set Light
			</button>
			<button type="button" onClick={() => setTheme("system")}>
				Set System
			</button>
		</div>
	);
}

describe("ThemeProvider & ModeToggle", () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		localStorage.clear();
		document.documentElement.classList.remove("light", "dark");

		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	it("uses default theme and sets root class accordingly", () => {
		render(
			<ThemeProvider defaultTheme="dark" storageKey="test-theme">
				<TestConsumer />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("current-theme").textContent).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("loads stored theme from localStorage", () => {
		localStorage.setItem("test-theme", "light");

		render(
			<ThemeProvider defaultTheme="dark" storageKey="test-theme">
				<TestConsumer />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("current-theme").textContent).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("updates document class and localStorage when theme changes", () => {
		render(
			<ThemeProvider defaultTheme="light" storageKey="test-theme">
				<TestConsumer />
			</ThemeProvider>,
		);

		expect(document.documentElement.classList.contains("dark")).toBe(false);

		fireEvent.click(screen.getByRole("button", { name: "Set Dark" }));
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(localStorage.getItem("test-theme")).toBe("dark");

		fireEvent.click(screen.getByRole("button", { name: "Set Light" }));
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(localStorage.getItem("test-theme")).toBe("light");
	});

	it("respects system preference when theme is system", () => {
		window.matchMedia = vi.fn().mockImplementation((query: string) => ({
			matches: true, // prefers dark
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));

		render(
			<ThemeProvider defaultTheme="system" storageKey="test-theme">
				<TestConsumer />
			</ThemeProvider>,
		);

		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("ModeToggle cycles through themes on click", () => {
		render(
			<ThemeProvider defaultTheme="light" storageKey="test-theme">
				<ModeToggle />
			</ThemeProvider>,
		);

		const getToggleBtn = () =>
			screen.getByRole("button", { name: /click to (change|switch) theme/i });
		expect(getToggleBtn()).toBeDefined();

		// light -> dark
		fireEvent.click(getToggleBtn());
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(localStorage.getItem("test-theme")).toBe("dark");

		// dark -> system (matches=false -> light)
		fireEvent.click(getToggleBtn());
		expect(localStorage.getItem("test-theme")).toBe("system");
		expect(document.documentElement.classList.contains("dark")).toBe(false);

		// system -> light
		fireEvent.click(getToggleBtn());
		expect(localStorage.getItem("test-theme")).toBe("light");
	});
});
