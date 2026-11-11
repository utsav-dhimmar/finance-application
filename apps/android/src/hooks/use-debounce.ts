import { useEffect, useState } from "react";

// Returns `value` once it has stayed unchanged for `delayMs`. Reusable for
// filter inputs and search boxes: callers keep the raw value on controlled
// inputs for immediate feedback while reacting to the debounced one.
export function useDebounce<T>(value: T, delayMs = 300): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebounced(value);
		}, delayMs);
		return () => {
			clearTimeout(timer);
		};
	}, [value, delayMs]);

	return debounced;
}
