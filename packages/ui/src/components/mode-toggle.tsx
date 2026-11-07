import { Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "./theme-provider";

export function ModeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();

	function cycleTheme() {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	}

	return (
		<Button
			variant="ghost"
			size="sm"
			className={className}
			onClick={cycleTheme}
			aria-label={`Current theme: ${theme}. Click to change theme.`}
			title={`Current theme: ${theme}. Click to switch theme.`}
		>
			<Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
