import { NextResponse } from "next/server";
import { getUserById } from "../../../../lib/db";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-please-change";

function base64urlToJson(b64: string) {
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (e) {
    return null;
  }
}

function verify(token: string) {
  try {
    const [h, b, s] = token.split(".");
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`${h}.${b}`)
      .digest();
    const got = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (!crypto.timingSafeEqual(expected, got)) return null;
    const payload = base64urlToJson(b);
    if (payload && payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token)
      return NextResponse.json(
        { ok: false, error: "no token" },
        { status: 401 },
      );
    const payload = verify(token);
    if (!payload)
      return NextResponse.json(
        { ok: false, error: "invalid token" },
        { status: 401 },
      );
    const user = getUserById(payload.sub);
    if (!user) {
      return NextResponse.json({
        ok: true,
        user: {
          id: payload.sub,
          username: payload.username || "user",
          role: payload.role || "candidate",
        },
      });
    }
    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
