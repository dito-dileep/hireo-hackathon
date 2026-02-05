import { NextResponse } from "next/server";
import { getResumesForSession } from "../../../../lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId required" },
        { status: 400 },
      );
    }

    const resumes = getResumesForSession(sessionId);
    if (!resumes.length) {
      return NextResponse.json(
        { ok: false, error: "no resume for session" },
        { status: 404 },
      );
    }

    const latest = resumes[resumes.length - 1];
    const filename = latest.filename || "resume";
    const buffer = Buffer.from(latest.content_base64 || "", "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

