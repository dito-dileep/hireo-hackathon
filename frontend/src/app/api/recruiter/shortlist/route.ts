import { NextResponse } from "next/server";
import { aiMatchResumeSkills } from "../../../../lib/ai_resume";

function normalize(s?: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillMatches(text: string, skill: string) {
  const t = text.toLowerCase();
  const s = skill.toLowerCase().trim();
  if (!s) return false;
  if (t.includes(s)) return true;
  try {
    const re = new RegExp(`\\b${escapeRegExp(s)}\\b`, "i");
    return re.test(text);
  } catch {
    return false;
  }
}

async function extractTextFromFile(file: Blob, base64: string) {
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
          text_excerpt = String(data.text).slice(0, 4000).toLowerCase();
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
          const pages = Math.min(4, doc.numPages || 1);
          for (let i = 1; i <= pages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const strings = (content.items || [])
              .map((it: any) => it.str || "")
              .join(" ");
            extracted += strings + "\n";
          }
          if (extracted.trim().length > 0) {
            text_excerpt = extracted.slice(0, 4000).toLowerCase();
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
      text_excerpt = printable.slice(0, 4000).toLowerCase();
    }
  } catch (e) {
    text_excerpt = null;
  }
  return text_excerpt || "";
}

function detectExperience(text: string) {
  let detectedExp = 0;
  const m = text.match(/(\d+)\s*(?:years|yrs|year)/);
  if (m) detectedExp = Number(m[1]);
  else {
    const m2 = text.match(/experience\s*[:\-]?\s*(\d+)/);
    if (m2) detectedExp = Number(m2[1]);
  }
  return detectedExp;
}

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
    const requiredSkillsRaw = fd.get("requiredSkills")?.toString() || "";
    const extraRequirements = fd.get("extraRequirements")?.toString() || "";
    const minExp = Number(fd.get("minExp")?.toString() || 0) || 0;

    const requiredSkills = requiredSkillsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const files = fd.getAll("resumes") as Blob[];
    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "no resumes uploaded" },
        { status: 400 },
      );
    }

    const results: any[] = [];

    for (const file of files) {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      const base64 = Buffer.from(binary, "binary").toString("base64");

      const text = await extractTextFromFile(file, base64);
      const norm = normalize(text + " " + (file as any).name);

      const matched: string[] = [];
      for (const sk of requiredSkills) {
        const skNorm = normalize(sk);
        if (norm.includes(skNorm) || skillMatches(text, sk)) matched.push(sk);
      }

      const detectedExp = detectExperience(text);
      const skillsMatched = matched.length;
      const skillsScore =
        requiredSkills.length === 0
          ? 1
          : skillsMatched / requiredSkills.length;
      const expScore = minExp === 0 ? 1 : detectedExp >= minExp ? 1 : detectedExp / minExp;

      let aiMatched: string[] | null = null;
      let aiConfidence = 0;
      let aiSummary = "";
      try {
        const ai = await aiMatchResumeSkills({
          resumeText: (text || "").slice(0, 2000),
          requiredSkills,
        });
        if (ai) {
          aiMatched = ai.matchedSkills;
          aiConfidence = ai.confidence || 0;
          aiSummary = ai.summary || "";
        }
      } catch {
        // ignore
      }

      const finalMatched = aiMatched || matched;
      const finalSkillsScore =
        requiredSkills.length === 0
          ? 1
          : finalMatched.length / requiredSkills.length;
      const score = Math.round(
        (finalSkillsScore * 0.65 + expScore * 0.25 + (aiConfidence ? aiConfidence * 0.1 : 0)) * 100,
      );

      results.push({
        filename: (file as any).name || "resume",
        matchedSkills: finalMatched,
        skillsMatched: finalMatched.length,
        requiredSkills,
        detectedExp,
        minExp,
        score,
        aiConfidence,
        aiSummary,
        extraRequirements,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
