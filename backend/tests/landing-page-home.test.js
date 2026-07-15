import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const query = vi.fn();

vi.mock("../src/config/db.js", () => ({
    default: { query },
}));

vi.mock("../src/utils/activity-log.js", () => ({
    recordActivity: vi.fn().mockResolvedValue(undefined),
}));

const { default: landingPageRoutes } = await import("../src/routes/landing-page.routes.js");

const app = express();
app.use(express.json());
app.use("/api/landing-page", landingPageRoutes);

describe("Home landing-page content", () => {
    beforeEach(() => {
        query.mockReset();
    });

    it("preserves saved text and media when blank composer fields are omitted", async () => {
        query
            .mockResolvedValueOnce({
                rows: [{ id: 1, image_urls: '["/uploads/existing.jpg"]' }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    section: "home",
                    title: "Saved title",
                    description: "Saved caption",
                    image_urls: '["/uploads/existing.jpg"]',
                    stats: null,
                }],
            });

        const response = await request(app)
            .put("/api/landing-page/home")
            .field("user_id", "7");

        expect(response.status).toBe(200);
        expect(response.body.image_urls).toEqual(["/uploads/existing.jpg"]);
        const updateParameters = query.mock.calls[1][1];
        expect(updateParameters[0]).toBeNull();
        expect(updateParameters[1]).toBeNull();
        expect(updateParameters[3]).toBe('["/uploads/existing.jpg"]');
    });

    it("rejects more than five Home media items", async () => {
        query.mockResolvedValueOnce({ rows: [] });
        const media = Array.from({ length: 6 }, (_, index) => `/uploads/${index}.jpg`);

        const response = await request(app)
            .put("/api/landing-page/home")
            .field("user_id", "7")
            .field("existing_images", JSON.stringify(media));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Home media is limited to 5 items");
        expect(query).toHaveBeenCalledTimes(1);
    });
});
