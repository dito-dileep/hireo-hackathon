import { NextResponse } from "next/server";
import {
  addJob,
  getJobs,
  addSubmission,
  updateJob,
  deleteJob,
  decrementVacancyOnPass,
} from "../../../lib/db";
import { gradeExtraQuestions } from "../../../lib/ai_grade";
import { gradeAllQuestions } from "../../../lib/ai_assess";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-please-change";

function verifyTokenFromHeaderOrCookie(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    let token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      const cookie = req.headers.get("cookie") || "";
      const m = cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("token="));
      if (m) token = m.split("=")[1];
    }
    if (!token) return null;
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

export async function GET() {
  try {
    const jobs = getJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // require recruiter role for job creation
    const payload = verifyTokenFromHeaderOrCookie(req);
    if (!payload || payload.role !== "recruiter")
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );
    const body = await req.json();
    const id = `job-${Date.now()}`;
    // accept optional requirements: skills (comma list) and minExp (years)
    const vRaw =
      body.vacancyTotal !== undefined ? body.vacancyTotal : body.vacancy;
    const vNum = Number(vRaw);
    const vacancy = Number.isFinite(vNum) && vNum > 0 ? vNum : undefined;
    const MAX_Q_LEN = 200;
    const extraQuestions = Array.isArray(body.extraQuestions)
      ? body.extraQuestions
          .map((q: any) => String(q || "").trim())
          .filter(Boolean)
          .map((q: string) => q.slice(0, MAX_Q_LEN))
      : typeof body.extraQuestion === "string" && body.extraQuestion.trim()
        ? [body.extraQuestion.trim().slice(0, MAX_Q_LEN)]
        : undefined;
    const extraExpectedAnswers = Array.isArray(body.extraExpectedAnswers)
      ? body.extraExpectedAnswers
          .map((a: any) => String(a || "").trim())
          .filter(Boolean)
          .map((a: string) => a.slice(0, MAX_Q_LEN))
      : undefined;
    let normalizedExpected = extraExpectedAnswers;
    if (!extraQuestions || extraQuestions.length === 0) {
      normalizedExpected = undefined;
    } else if (normalizedExpected && normalizedExpected.length !== extraQuestions.length) {
      normalizedExpected = normalizedExpected.slice(0, extraQuestions.length);
    }
    const timeLimitMinutesRaw =
      body.timeLimitMinutes !== undefined ? body.timeLimitMinutes : body.timeLimit;
    const baseTime = 15;
    const minTime =
      extraQuestions && extraQuestions.length
        ? baseTime + extraQuestions.length * 2
        : baseTime;
    const timeLimitMinutes =
      timeLimitMinutesRaw !== undefined
        ? Math.max(minTime, Number(timeLimitMinutesRaw))
        : minTime;
    const job = {
      id,
      title: body.title,
      description: body.description,
      company: body.company,
      skills: body.skills || [],
      minExp: body.minExp || 0,
      vacancyTotal: vacancy,
      vacancyRemaining: vacancy,
      extraQuestions,
      extraExpectedAnswers: normalizedExpected,
      timeLimitMinutes,
    };
    addJob(job);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    // Require authenticated candidate for submissions
    const payload = verifyTokenFromHeaderOrCookie(req);
    if (!payload || payload.role !== "candidate")
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );

    const tabSwitches = Number(body.tabSwitches || 0);
    const multiFaceDetected = !!body?.proctorFlags?.multiFaceDetected;

    // Delegate scoring to FastAPI backend
    const answers = body.answers || {};
    let score = 0;
    let technicalScore: number | null = null;
    let reasoningScore: number | null = null;
    let finalPassed = false;
    let explanation = "";

    try {
      const res = await fetch("http://localhost:8000/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, tabSwitches }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          score = data.score ?? 0;
          technicalScore =
            typeof data.technicalScore === "number" ? data.technicalScore : null;
          reasoningScore =
            typeof data.reasoningScore === "number" ? data.reasoningScore : null;
          finalPassed = !!data.passed;
          explanation =
            typeof data.explanation === "string" ? data.explanation : "";
        }
      }
    } catch (e) {
      console.error("backend scoring error", e);
    }

    if (!explanation && score === 0 && !finalPassed) {
      explanation =
        "Scoring backend unavailable; this attempt could not be fully evaluated.";
    }

    let extraAi = null;
    let aiAll = null;
    try {
      if (body.jobId) {
        const jobs = getJobs();
        const job = jobs.find((j: any) => j.id === body.jobId);
        const aiQuestions = [
          {
            id: "1",
            prompt: "Quick logic check: What is 2 + 2?",
            expected: "4",
            candidate: String(answers["1"] ?? ""),
            category: "reasoning",
          },
          {
            id: "2",
            prompt: "General awareness: Capital of France?",
            expected: "Paris",
            candidate: String(answers["2"] ?? ""),
            category: "reasoning",
          },
          {
            id: "3",
            prompt:
              "Aptitude: If a train goes 60km in 1 hour 20 minutes, what's its average speed (km/h)?",
            expected: "45 km/h",
            candidate: String(answers["3"] ?? ""),
            category: "reasoning",
          },
          {
            id: "4",
            prompt: "Coding: Write a function that returns the sum of an array.",
            expected: "Use a loop or reduce to sum array items and return total.",
            candidate: String(answers["4"] ?? ""),
            category: "technical",
          },
          {
            id: "5",
            prompt:
              "Communication: Briefly explain how you would debug a failing API in production.",
            expected:
              "Check logs/metrics, isolate error, reproduce, rollback or use feature flags, monitor.",
            candidate: String(answers["5"] ?? ""),
            category: "reasoning",
          },
          {
            id: "6",
            prompt:
              "Workstyle slider: On a scale of 1–10, how comfortable are you working independently?",
            expected: "A number between 1 and 10.",
            candidate: String(answers["6"] ?? ""),
            category: "reasoning",
          },
        ];
        if (Array.isArray(job?.extraQuestions)) {
          job.extraQuestions.forEach((q: string, i: number) => {
            aiQuestions.push({
              id: `extra-${i}`,
              prompt: q,
              expected:
                (Array.isArray(job?.extraExpectedAnswers) &&
                  job.extraExpectedAnswers[i]) ||
                "Reasonable correct answer.",
              candidate: String(answers[`extra-${i}`] ?? ""),
              category: "extra",
            });
          });
        }
        const aiRes = await gradeAllQuestions(aiQuestions);
        if (aiRes) {
          aiAll = aiRes;
        }
        const extraQs: string[] = Array.isArray(job?.extraQuestions)
          ? job.extraQuestions
          : [];
        const expected: string[] = Array.isArray(job?.extraExpectedAnswers)
          ? job.extraExpectedAnswers
          : [];
        if (extraQs.length && expected.length) {
          const count = Math.min(extraQs.length, expected.length);
          const candidateAnswers = [];
          for (let i = 0; i < count; i++) {
            candidateAnswers.push(String(answers[`extra-${i}`] || ""));
          }
          const ai = await gradeExtraQuestions({
            questions: extraQs.slice(0, count),
            expectedAnswers: expected.slice(0, count),
            candidateAnswers,
          });
          if (ai) extraAi = ai;
        }
      }
    } catch (e) {
      console.error("extra ai grading error", e);
    }

    if (aiAll) {
      score = aiAll.overallScore;
      if (typeof aiAll.technicalScore === "number")
        technicalScore = aiAll.technicalScore;
      if (typeof aiAll.reasoningScore === "number")
        reasoningScore = aiAll.reasoningScore;
      // Use backend explain endpoint for consistent language
      try {
        const expRes = await fetch("http://localhost:8000/ai/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            score,
            technicalScore,
            reasoningScore,
            tabSwitches,
          }),
        });
        if (expRes.ok) {
          const data = await expRes.json();
          if (data && data.ok && typeof data.explanation === "string") {
            explanation = data.explanation;
          }
        }
      } catch (e) {
        // ignore explanation errors
      }
    }

    // When AI grading is used, recompute pass/fail from AI score + integrity
    if (aiAll) {
      const proctor_hard_fail = tabSwitches > 1 || multiFaceDetected;
      finalPassed = score >= 60 && !proctor_hard_fail;
    }

    if (multiFaceDetected) {
      explanation = explanation
        ? `${explanation} Multiple faces were detected during the assessment.`
        : "Multiple faces were detected during the assessment.";
      finalPassed = false;
    }

    addSubmission({
      jobId: body.jobId,
      sessionId: body.sessionId,
      answers: body.answers,
      score,
      passed: finalPassed,
      technicalScore,
      reasoningScore,
      explanation,
      candidateUsername: payload.username,
      tabSwitches,
      proctorFlags: body?.proctorFlags || null,
      extraAi,
      aiAll,
    });

    if (finalPassed && body.jobId) {
      try {
        decrementVacancyOnPass(body.jobId);
      } catch (e) {
        console.error("vacancy decrement error", e);
      }
    }
    return NextResponse.json({
      ok: true,
      score,
      passed: finalPassed,
      technicalScore,
      reasoningScore,
      explanation,
      tabSwitches,
      aiScore: aiAll ? aiAll.overallScore : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = verifyTokenFromHeaderOrCookie(req);
    if (!payload || payload.role !== "recruiter")
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );
    const body = await req.json();
    const jobId = body.jobId || body.id;
    if (!jobId)
      return NextResponse.json(
        { ok: false, error: "jobId required" },
        { status: 400 },
      );
    const updates: any = {};
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.description === "string") updates.description = body.description;
    if (typeof body.company === "string") updates.company = body.company;
    if (Array.isArray(body.skills)) updates.skills = body.skills;
    if (typeof body.minExp === "number") updates.minExp = body.minExp;
    const MAX_Q_LEN = 200;
    if (Array.isArray(body.extraQuestions)) {
      const list = body.extraQuestions
        .map((q: any) => String(q || "").trim())
        .filter(Boolean)
        .map((q: string) => q.slice(0, MAX_Q_LEN));
      updates.extraQuestions = list.length ? list : undefined;
    } else if (typeof body.extraQuestion === "string") {
      const trimmed = body.extraQuestion.trim();
      updates.extraQuestions = trimmed ? [trimmed.slice(0, MAX_Q_LEN)] : undefined;
    }
    if (Array.isArray(body.extraExpectedAnswers)) {
      const list = body.extraExpectedAnswers
        .map((a: any) => String(a || "").trim())
        .filter(Boolean)
        .map((a: string) => a.slice(0, MAX_Q_LEN));
      updates.extraExpectedAnswers = list.length ? list : undefined;
    }
    if (Array.isArray(updates.extraQuestions) && Array.isArray(updates.extraExpectedAnswers)) {
      if (updates.extraExpectedAnswers.length !== updates.extraQuestions.length) {
        updates.extraExpectedAnswers = updates.extraExpectedAnswers.slice(
          0,
          updates.extraQuestions.length,
        );
      }
    }
    if (Array.isArray(updates.extraQuestions) && updates.extraQuestions.length === 0) {
      updates.extraExpectedAnswers = undefined;
    }
    const timeLimitRaw =
      body.timeLimitMinutes !== undefined ? body.timeLimitMinutes : body.timeLimit;
    if (timeLimitRaw !== undefined) {
      const vNum = Number(timeLimitRaw);
      if (Number.isFinite(vNum) && vNum > 0) {
        const count = Array.isArray(updates.extraQuestions)
          ? updates.extraQuestions.length
          : 0;
        const minTime = 15 + count * 2;
        updates.timeLimitMinutes = Math.max(minTime, vNum);
      }
    } else if (Array.isArray(updates.extraQuestions)) {
      updates.timeLimitMinutes = 15 + updates.extraQuestions.length * 2;
    }
    const vRaw =
      body.vacancyTotal !== undefined ? body.vacancyTotal : body.vacancy;
    if (vRaw !== undefined) {
      const vNum = Number(vRaw);
      if (Number.isFinite(vNum) && vNum > 0) {
        updates.vacancyTotal = vNum;
        updates.vacancyRemaining = vNum;
      }
    }
    const updated = updateJob(jobId, updates);
    if (!updated)
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, job: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const payload = verifyTokenFromHeaderOrCookie(req);
    if (!payload || payload.role !== "recruiter")
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );
    const body = await req.json();
    const jobId = body.jobId || body.id;
    if (!jobId)
      return NextResponse.json(
        { ok: false, error: "jobId required" },
        { status: 400 },
      );
    const ok = deleteJob(jobId);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
