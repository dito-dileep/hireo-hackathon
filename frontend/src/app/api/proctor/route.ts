import { NextResponse } from "next/server";
import { addProctorLog, getProctorLogsForSession } from "../../../lib/db";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("form-data")
    ) {
      const fd = await req.formData();
      const sessionId = fd.get("sessionId")?.toString() || "unknown";
      const img = fd.get("image") as Blob | null;
      const faceCountRaw = fd.get("face_count")?.toString();
      const face_count = faceCountRaw ? Number(faceCountRaw) : null;
      let imgBase64 = null;
      if (img) {
        const ab = await img.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++)
          binary += String.fromCharCode(bytes[i]);
        imgBase64 = Buffer.from(binary, "binary").toString("base64");
      }
      addProctorLog({
        sessionId,
        type: "capture",
        image_base64: imgBase64,
        payload: face_count !== null ? { face_count } : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    const body = await req.text();
    try {
      const ev = JSON.parse(body);
      const sessionId = ev.sessionId || "unknown";
      addProctorLog({ sessionId, type: ev.type || "event", payload: ev });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "invalid payload" },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId)
      return NextResponse.json(
        { ok: false, error: "sessionId required" },
        { status: 400 },
      );
    const logs = getProctorLogsForSession(sessionId);
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
