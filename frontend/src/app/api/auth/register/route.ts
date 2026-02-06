import { NextResponse } from "next/server";
import { addUser, getUserByUsername } from "../../../../lib/db";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, role } = body;
    const captchaToken = body.captchaToken;
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (secret) {
      if (!captchaToken)
        return NextResponse.json(
          { ok: false, error: "captcha required" },
          { status: 400 },
        );
      const params = new URLSearchParams();
      params.append("secret", secret);
      params.append("response", captchaToken);
      const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const vj = await verify.json();
      if (!vj.success)
        return NextResponse.json(
          { ok: false, error: "captcha failed" },
          { status: 400 },
        );
    }
    if (!username || !password)
      return NextResponse.json(
        { ok: false, error: "username and password required" },
        { status: 400 },
      );
    const existing = getUserByUsername(username);
    if (existing)
      return NextResponse.json(
        { ok: false, error: "user exists" },
        { status: 400 },
      );

    const salt = crypto.randomBytes(8).toString("hex");
    const hash = crypto
      .createHash("sha256")
      .update(salt + password)
      .digest("hex");
    const id = `user-${Date.now()}`;
    const demoAuth = process.env.DEMO_AUTH === "1" || process.env.VERCEL === "1";
    try {
      addUser({
        id,
        username,
        passwordHash: `${salt}$${hash}`,
        role: role || "candidate",
      });
      return NextResponse.json({
        ok: true,
        user: { id, username, role: role || "candidate" },
      });
    } catch (e) {
      if (!demoAuth) throw e;
      return NextResponse.json({
        ok: true,
        user: { id, username, role: role || "candidate" },
      });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
