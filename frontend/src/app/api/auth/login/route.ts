import { NextResponse } from "next/server";
import { getUserByUsername } from "../../../../lib/db";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-please-change";

function base64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: any) {
  const header = base64url(
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest();
  return `${header}.${body}.${base64url(sig)}`;
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
    const payload = JSON.parse(Buffer.from(b, "base64").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;
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
    const demoAuth = process.env.DEMO_AUTH === "1" || process.env.VERCEL === "1";
    const user = getUserByUsername(username);
    if (!user)
      if (!demoAuth)
        return NextResponse.json(
          { ok: false, error: "invalid" },
          { status: 401 },
        );
    if (user) {
      const [salt, hash] = (user.passwordHash || "").split("$");
      const candidate = crypto
        .createHash("sha256")
        .update(salt + password)
        .digest("hex");
      if (!demoAuth && candidate !== hash)
        return NextResponse.json(
          { ok: false, error: "invalid" },
          { status: 401 },
        );
    }

    const payload = {
      sub: user?.id || `user-${Date.now()}`,
      username: user?.username || username,
      role: user?.role || "candidate",
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };
    const token = sign(payload);
    const res = NextResponse.json({
      ok: true,
      token,
      user: {
        id: user?.id || `user-${Date.now()}`,
        username: user?.username || username,
        role: user?.role || "candidate",
      },
    });
    // set HttpOnly cookie for session (demo)
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
