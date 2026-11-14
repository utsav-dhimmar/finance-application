import { cleanup } from "@testing-library/react-native";
import * as matchers from "@testing-library/react-native/matchers";
import { afterEach, expect, vi } from "vitest";

// The native dropdown-menu layer is mocked once here for every test file:
// the production SelectField renders zeego items, whose native module is
// absent under the Node-only test engine. The fake mirrors the real menu's
// observable behavior — options stay hidden until the trigger is pressed and
// the menu closes after a selection — so full-screen tests query options the
// same way users reach them, without stray option text colliding with
// screen content. Everything is defined inside the factory because vi.mock
// factories are hoisted and cannot close over outer bindings.
vi.mock("zeego/dropdown-menu", async () => {
	const {
		createContext,
		createElement,
		cloneElement,
		isValidElement,
		useContext,
		useState,
	} = await import("react");
	const { Pressable, Text } = await import("react-native");

	interface FakeMenuContextValue {
		open: boolean;
		setOpen: (open: boolean) => void;
	}

	const FakeMenuContext = createContext<FakeMenuContextValue | null>(null);

	function useFakeMenu(): FakeMenuContextValue {
		const context = useContext(FakeMenuContext);
		if (context === null) {
			throw new Error("Menu parts must render inside DropdownMenu.Root");
		}
		return context;
	}

	const Root = ({ children }: { children: React.ReactNode }) => {
		const [open, setOpen] = useState(false);
		return createElement(
			FakeMenuContext.Provider,
			{ value: { open, setOpen } },
			children,
		);
	};

	const Trigger = ({
		children,
	}: {
		children: React.ReactElement<{ onPress?: () => void }>;
	}) => {
		const { setOpen } = useFakeMenu();
		if (!isValidElement(children)) {
			return children;
		}
		// The real Trigger clones its child with the press handler that opens
		// the native menu; the fake opens the inline option list instead.
		return cloneElement(children, {
			onPress: () => {
				setOpen(true);
			},
		});
	};

	const Content = ({ children }: { children: React.ReactNode }) => {
		const { open } = useFakeMenu();
		return open ? children : null;
	};

	const CheckboxItem = ({
		value,
		onSelect,
		"aria-label": ariaLabel,
		children,
	}: {
		value: boolean;
		onSelect?: () => void;
		"aria-label"?: string;
		children: React.ReactNode;
	}) => {
		const { setOpen } = useFakeMenu();
		return createElement(
			Pressable,
			{
				accessibilityLabel: ariaLabel,
				accessibilityRole: "checkbox",
				accessibilityState: { checked: value },
				onPress: () => {
					// Real native menus dismiss after an item activation.
					setOpen(false);
					onSelect?.();
				},
			},
			children,
		);
	};

	return {
		Root,
		Trigger,
		Content,
		CheckboxItem,
		ItemIndicator: () => null,
		ItemTitle: ({ children }: { children: React.ReactNode }) =>
			createElement(Text, null, children),
	};
});

// Register React Native Testing Library's custom matchers on vitest's
// expect and unmount rendered components after every test (vitest does not
// expose global afterEach, so RNTL's automatic cleanup does not trigger).
expect.extend(matchers);

afterEach(() => {
	cleanup();
});
