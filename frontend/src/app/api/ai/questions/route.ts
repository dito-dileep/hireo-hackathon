import { NextResponse } from "next/server";
import { generateAiQuestions } from "../../../../lib/ai_questions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const resumeText = String(body?.resumeText || "");
    const requiredSkills = Array.isArray(body?.requiredSkills)
      ? body.requiredSkills.map((s: any) => String(s))
      : [];
    const roleTitle = String(body?.roleTitle || "");
    const count = Number(body?.count || 3) || 3;

    const effectiveResumeText =
      resumeText ||
      (requiredSkills.length
        ? `Skills: ${requiredSkills.join(", ")}`
        : "");

    if (!effectiveResumeText) {
      return NextResponse.json(
        { ok: false, error: "resumeText required" },
        { status: 400 },
      );
    }

    const questions = await generateAiQuestions({
      resumeText: effectiveResumeText,
      requiredSkills,
      roleTitle,
      count,
    });

    if (!questions || questions.length === 0) {
      return NextResponse.json({
        ok: false,
        error:
          "AI question generation unavailable. Check OPENAI_API_KEY or try again.",
      });
    }
    return NextResponse.json({ ok: true, questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
