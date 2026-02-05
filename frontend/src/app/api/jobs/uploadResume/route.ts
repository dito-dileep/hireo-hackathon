import { NextResponse } from "next/server";
import { addResume, getJobs } from "../../../../lib/db";
import { aiMatchResumeSkills } from "../../../../lib/ai_resume";

// Safe helpers
function normalize(s?: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function detectEmails(text: string) {
  try {
    const m = text.match(/[\w.%-]+@[\w.-]+\.[A-Za-z]{2,6}/g);
    return m || [];
  } catch (e) {
    return [];
  }
}

function detectPhone(text: string) {
  try {
    const m = text.match(/\+?\d[\d\s().-]{6,}\d/g);
    return m ? m[0] : null;
  } catch (e) {
    return null;
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillMatches(text: string, skill: string) {
  const t = text.toLowerCase();
  const s = skill.toLowerCase().trim();
  if (!s) return false;
  if (t.includes(s)) return true;
  // Try word-boundary matching for cleaner hits (e.g., "java" vs "javascript")
  try {
    const re = new RegExp(`\\b${escapeRegExp(s)}\\b`, "i");
    return re.test(text);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data"))
      return NextResponse.json({ ok: false, error: "multipart/form-data required" }, { status: 400 });

    const fd = await req.formData();
    const file = fd.get("resume") as Blob | null;
    const jobId = fd.get("jobId")?.toString() || null;
    const sessionId = fd.get("sessionId")?.toString() || `session-${Date.now()}`;

    if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

    // Read file bytes into base64
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = Buffer.from(binary, "binary").toString("base64");

    // Extract text: prefer server-side PDF parsing when possible
    let text_excerpt: string | null = null;
    try {
      const filename = (file as any).name || "";
      const isPdf = ((file as any).type && (file as any).type.toLowerCase().includes("pdf")) || filename.toLowerCase().endsWith(".pdf");
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
        // Fallback to pdfjs-dist extraction if pdf-parse produced little/no text.
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

      // Always fall back to a simple UTF-8 view of the file so that we
      // still have something to keyword match against, even for odd PDFs.
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

    // persist resume to local JSON DB
    addResume({
      jobId: jobId || undefined,
      sessionId,
      filename: (file as any).name || "resume",
      content_base64: base64,
      text_excerpt: text_excerpt || undefined,
    });

    if (jobId) {
      const jobs = getJobs();
      const job = jobs.find((j: any) => j.id === jobId);
      if (job) {
        const requiredSkills: string[] = (job.skills || []).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean);
        const minExp = Number(job.minExp) || 0;

        const matched: string[] = [];
        const rawText = (text_excerpt || "") + " " + ((file as any).name || "");
        const norm =
          normalize(rawText);
        for (const sk of requiredSkills) {
          const skNorm = normalize(sk);
          if (norm.includes(skNorm) || skillMatches(rawText, sk)) matched.push(sk);
          else {
            const cleaned = norm.replace(/[^a-z0-9]/g, "");
            if (cleaned.includes(skNorm.replace(/[^a-z0-9]/g, "")))
              matched.push(sk);
          }
        }

        // experience heuristics
        let detectedExp = 0;
        if (text_excerpt) {
          const m = text_excerpt.match(/(\d+)\s*(?:years|yrs|year)/);
          if (m) detectedExp = Number(m[1]);
          else {
            const m2 = text_excerpt.match(/experience\s*[:\-]?\s*(\d+)/);
            if (m2) detectedExp = Number(m2[1]);
          }
        }

        const skillsMatched = matched.length;
        const skillsOk = requiredSkills.length === 0 || skillsMatched >= Math.max(1, Math.round(requiredSkills.length * 0.6));
        const expOk = detectedExp >= minExp;

        const emails = text_excerpt ? detectEmails(text_excerpt) : [];
        const phone = text_excerpt ? detectPhone(text_excerpt) : null;

        // AI skill matching (optional, only if API key set)
        let aiMatched: string[] | null = null;
        try {
          const hasKey = !!process.env.OPENAI_API_KEY;
          console.info("AI resume matcher enabled:", hasKey);
          const ai = await aiMatchResumeSkills({
            resumeText: (text_excerpt || "").slice(0, 2000),
            requiredSkills,
          });
          if (ai && Array.isArray(ai.matchedSkills)) {
            console.info("AI resume matched skills:", ai.matchedSkills);
            aiMatched = ai.matchedSkills;
          } else {
            console.info("AI resume returned no matches.");
          }
        } catch (e) {
          console.warn("AI resume match error", e);
          // ignore AI errors
        }

        const finalMatched = aiMatched || matched;
        const finalSkillsMatched = finalMatched.length;
        const finalSkillsOk =
          requiredSkills.length === 0 ||
          finalSkillsMatched >= Math.max(1, Math.round(requiredSkills.length * 0.6));

        return NextResponse.json({
          ok: true,
          sessionId,
          filename: (file as any).name || "resume",
          skillsMatched: finalSkillsMatched,
          matchedSkills: finalMatched,
          requiredSkills,
          detectedExp,
          skillsOk: finalSkillsOk,
          expOk,
          emails,
          phone,
        });
      }
    }

    return NextResponse.json({ ok: true, sessionId, filename: (file as any).name || "resume", skillsMatched: 0, requiredSkills: [], detectedExp: 0, skillsOk: true, expOk: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
