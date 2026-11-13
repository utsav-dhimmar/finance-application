import { cleanup } from "@testing-library/react-native";
import * as matchers from "@testing-library/react-native/matchers";
import { afterEach, expect } from "vitest";

// Register React Native Testing Library's custom matchers on vitest's
// expect and unmount rendered components after every test (vitest does not
// expose global afterEach, so RNTL's automatic cleanup does not trigger).
expect.extend(matchers);

afterEach(() => {
	cleanup();
});
