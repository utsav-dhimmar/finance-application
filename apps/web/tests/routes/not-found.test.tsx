import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFound } from "@/routes/__root";

describe("not-found view", () => {
	it("renders a not-found message", () => {
		render(<NotFound />);
		expect(
			screen.getByRole("heading", { name: /page not found/i }),
		).toBeTruthy();
	});
});
