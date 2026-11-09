import { describe, expect, it } from "vitest";

import { parseSetCookie } from "./cookies";

describe("parseSetCookie", () => {
	it("parses a single header with attributes stripped", () => {
		expect(
			parseSetCookie(
				"__Host-access_token=jwt.value; Path=/; HttpOnly; Secure; SameSite=Lax",
			),
		).toEqual([{ name: "__Host-access_token", value: "jwt.value" }]);
	});

	it("parses separate header entries (Headers.getSetCookie form)", () => {
		expect(
			parseSetCookie([
				"__Host-access_token=access-1; Path=/; HttpOnly; Secure",
				"__Secure-refresh_token=refresh-1; Path=/api/auth; HttpOnly; Secure",
			]),
		).toEqual([
			{ name: "__Host-access_token", value: "access-1" },
			{ name: "__Secure-refresh_token", value: "refresh-1" },
		]);
	});

	it("splits a comma-joined header (Android form) into both cookies", () => {
		expect(
			parseSetCookie(
				"__Host-access_token=access-1; Path=/; HttpOnly; Secure, __Secure-refresh_token=refresh-1; Path=/api/auth; HttpOnly; Secure",
			),
		).toEqual([
			{ name: "__Host-access_token", value: "access-1" },
			{ name: "__Secure-refresh_token", value: "refresh-1" },
		]);
	});

	it("keeps the comma inside an Expires date", () => {
		expect(
			parseSetCookie(
				"__Host-access_token=access-1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly, __Secure-refresh_token=refresh-1; Path=/api/auth; Expires=Thu, 01 Jan 2027 00:00:00 GMT",
			),
		).toEqual([
			{ name: "__Host-access_token", value: "access-1" },
			{ name: "__Secure-refresh_token", value: "refresh-1" },
		]);
	});

	it("keeps attribute values that contain equals signs", () => {
		expect(parseSetCookie("sid=abc; Path=/; Priority=High; SameSite=Lax")).toEqual(
			[{ name: "sid", value: "abc" }],
		);
	});

	it("skips malformed segments", () => {
		expect(parseSetCookie(["not-a-cookie", "", "ok=1; Path=/"])).toEqual([
			{ name: "ok", value: "1" },
		]);
	});
});
