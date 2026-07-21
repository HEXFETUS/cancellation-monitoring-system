import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson, fetchSheetRows } from "../src/routes/cancellation.routes.js";

const endpoint = new URL("https://script.google.com/macros/s/test/exec");

function response(body, options = {}) {
    return new Response(body, {
        status: options.status ?? 200,
        headers: { "Content-Type": options.contentType ?? "application/json" },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("cancellation Google Sheet response parsing", () => {
    it("accepts a regular JSON object", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('{"CDO":[{"DATE":"2026-07-21"}]}')));

        await expect(fetchJson(endpoint)).resolves.toEqual({
            CDO: [{ DATE: "2026-07-21" }],
        });
    });

    it("accepts one JSON-encoded string wrapper", async () => {
        const payload = JSON.stringify(JSON.stringify({ MISOR: [{ DATE: "2026-07-21" }] }));
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload)));

        await expect(fetchJson(endpoint)).resolves.toEqual({
            MISOR: [{ DATE: "2026-07-21" }],
        });
    });

    it.each([
        ["malformed JSON", "not-json"],
        ["a JSON scalar", "123"],
        ["a malformed encoded wrapper", JSON.stringify("not-json")],
    ])("rejects %s", async (_label, payload) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload)));

        await expect(fetchJson(endpoint)).rejects.toThrow(
            "Google Sheet endpoint did not return JSON rows"
        );
    });

    it("rejects an HTML deployment response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("<!doctype html><title>Sign in</title>", { contentType: "text/html" })));

        await expect(fetchJson(endpoint)).rejects.toThrow(
            "Google Apps Script returned an HTML page instead of JSON"
        );
    });

    it("rejects a valid but empty CDO/MISOR response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation(() =>
                Promise.resolve(response('{"CDO":[],"MISOR":[]}'))
            )
        );

        await expect(fetchSheetRows()).rejects.toThrow(
            "Google Sheet endpoint returned no rows for the CDO or MISOR sheets"
        );
    });
});
