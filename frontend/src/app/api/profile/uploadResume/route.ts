import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "multipart/form-data required" },
        { status: 400 },
      );
    }

    const fd = await req.formData();
    const file = fd.get("resume") as Blob | null;
    const username = fd.get("username")?.toString() || "";
    if (!file || !username) {
      return NextResponse.json(
        { ok: false, error: "file and username required" },
        { status: 400 },
      );
    }

    // Read file bytes into base64
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = Buffer.from(binary, "binary").toString("base64");

    // Extract text (best-effort)
    let text_excerpt: string | null = null;
    try {
      const filename = (file as any).name || "";
      const isPdf =
        ((file as any).type &&
          (file as any).type.toLowerCase().includes("pdf")) ||
        filename.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        try {
          const pdfLib = await import("pdf-parse");
          const buf = Buffer.from(base64, "base64");
          const data = await (pdfLib.default || pdfLib)(buf);
          if (data && data.text)
            text_excerpt = String(data.text).slice(0, 2000).toLowerCase();
        } catch (e) {
          console.warn("pdf-parse error", e);
        }
        if (!text_excerpt || text_excerpt.trim().length < 30) {
          try {
            const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
            const buf = Buffer.from(base64, "base64");
            const task = (pdfjs as any).getDocument({ data: buf });
            const doc = await task.promise;
            let extracted = "";
            const pages = Math.min(3, doc.numPages || 1);
            for (let i = 1; i <= pages; i++) {
              const page = await doc.getPage(i);
              const content = await page.getTextContent();
              const strings = (content.items || [])
                .map((it: any) => it.str || "")
                .join(" ");
              extracted += strings + "\n";
            }
            if (extracted.trim().length > 0) {
              text_excerpt = extracted.slice(0, 2000).toLowerCase();
            }
          } catch (e2) {
            console.warn("pdfjs-dist fallback failed", e2);
          }
        }
      }

      if (!text_excerpt) {
        const asUtf8 = Buffer.from(base64, "base64").toString("utf8");
        const printable = asUtf8.replace(
          new RegExp("[^\\x20-\\x7E\\r\\n]", "g"),
          "",
        );
        text_excerpt = printable.slice(0, 2000).toLowerCase();
      }
    } catch (e) {
      text_excerpt = null;
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/profiles/${encodeURIComponent(username)}/resume`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          resumeFilename: (file as any).name || "resume",
          resumeBase64: base64,
          resumeText: text_excerpt || "",
        }),
      },
    );
    const backendJson = await backendRes.json().catch(() => null);

    return NextResponse.json({
      ok: true,
      profile: backendJson?.profile || null,
      resumeFilename: (file as any).name || "resume",
      resumeText: text_excerpt || "",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}
