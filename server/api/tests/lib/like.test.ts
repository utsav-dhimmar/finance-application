import { describe, expect, it } from "vitest";
import { LIKE_ESCAPE, escapeLike } from "@/lib/like";

describe("escapeLike", () => {
	it("escapes the LIKE wildcards and the escape character", () => {
		expect(escapeLike("50%_off\\now")).toBe("50\\%\\_off\\\\now");
	});

	it("leaves ordinary text untouched", () => {
		expect(escapeLike("groceries 1250")).toBe("groceries 1250");
	});

	it("pairs with the bound ESCAPE character", () => {
		// The escape clause takes the same character the helper prefixes, so a
		// pattern built from escaped text matches that text literally.
		expect(LIKE_ESCAPE).toBe("\\");
	});
});
