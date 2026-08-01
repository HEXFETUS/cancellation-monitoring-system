import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { authenticate, authorizeRole, createSessionToken, requireRoles } from "../src/middleware/auth.js";

const app = express();
app.get("/protected", authenticate, (req, res) => res.json({ user: req.user }));
app.get("/admin", authenticate, requireRoles("admin"), (_req, res) => res.sendStatus(204));
app.post("/operator-change-requests/:id/approve", authenticate, authorizeRole, (_req, res) => res.sendStatus(204));
app.get("/operator-change-requests", authenticate, authorizeRole, (_req, res) => res.sendStatus(204));

describe("session authentication", () => {
    it("rejects a request without a bearer token", async () => {
        expect((await request(app).get("/protected")).status).toBe(401);
    });

    it("accepts a valid signed token and establishes server-side identity", async () => {
        const token = createSessionToken({ id: 42, usertype: "admin" });
        const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.body.user).toEqual({ id: 42, usertype: "admin" });
    });

    it("rejects a token whose payload was altered", async () => {
        const token = createSessionToken({ id: 42, usertype: "operator" });
        const [version, payload, signature] = token.split(".");
        const alteredPayload = Buffer.from(JSON.stringify({
            ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), role: "admin",
        })).toString("base64url");
        const response = await request(app)
            .get("/protected")
            .set("Authorization", `Bearer ${version}.${alteredPayload}.${signature}`);
        expect(response.status).toBe(401);
    });

    it("uses signed identity rather than query or x-user-id values for roles", async () => {
        const token = createSessionToken({ id: 7, usertype: "operator" });
        const response = await request(app)
            .get("/admin?user_id=1")
            .set("Authorization", `Bearer ${token}`)
            .set("x-user-id", "1");
        expect(response.status).toBe(403);
    });

    it("prevents operators from approving requests or listing another operator's requests", async () => {
        const token = createSessionToken({ id: 7, usertype: "operator" });
        const approve = await request(app)
            .post("/operator-change-requests/2/approve")
            .set("Authorization", `Bearer ${token}`)
            .send({ user_id: 7 });
        const list = await request(app)
            .get("/operator-change-requests?userId=8")
            .set("Authorization", `Bearer ${token}`);
        expect(approve.status).toBe(403);
        expect(list.status).toBe(403);
    });
});
