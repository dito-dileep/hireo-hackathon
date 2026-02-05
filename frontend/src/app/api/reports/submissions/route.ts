import { NextResponse } from "next/server";
import { getSubmissionsForSession } from "../../../../lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId)
      return NextResponse.json(
        { ok: false, error: "sessionId required" },
        { status: 400 },
      );
    const subs = getSubmissionsForSession(sessionId);
    return NextResponse.json({ ok: true, submissions: subs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
