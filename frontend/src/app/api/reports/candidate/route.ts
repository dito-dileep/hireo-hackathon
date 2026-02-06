import { NextResponse } from "next/server";
import { getAllSubmissions } from "../../../../lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");
    if (!username)
      return NextResponse.json(
        { ok: false, error: "username required" },
        { status: 400 },
      );
    const subs = getAllSubmissions().filter(
      (s) => s.candidateUsername === username,
    );
    return NextResponse.json({ ok: true, submissions: subs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
