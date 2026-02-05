import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Demo: accept any credentials and return a mock token
    const token = `token-${Date.now()}`;
    const role = body.role || "candidate";
    return NextResponse.json({ ok: true, token, role });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
