import { NextResponse } from "next/server";
import { getProctorLogsForSession, getSubmissionsForSession } from "../../../../lib/db";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = body.sessionId;
    if (!sessionId)
      return NextResponse.json(
        { ok: false, error: "sessionId required" },
        { status: 400 },
      );

    const logs = getProctorLogsForSession(sessionId);
    // simple heuristic analysis
    const visibilityEvents = logs.filter(
      (l: any) =>
        l.type === "visibility" ||
        (l.payload && l.payload.type === "visibility"),
    ).length;
    const captures = logs.filter(
      (l: any) => l.type === "capture" && l.image_base64,
    ).length;
    const faceEvents = logs
      .map((l: any) => {
        if (l.payload && l.payload.face_count !== undefined)
          return Number(l.payload.face_count);
        return null;
      })
      .filter((x) => x !== null) as number[];
    const multiFaceOccurrences = faceEvents.filter(
      (c) => c !== null && c > 1,
    ).length;

    // suspicious if many visibility changes, few captures, or multiple faces detected
    const suspicious =
      visibilityEvents > 2 || captures < 1 || multiFaceOccurrences > 0;

    const score = Math.max(
      0,
      100 -
        visibilityEvents * 20 -
        (captures < 1 ? 40 : 0) -
        multiFaceOccurrences * 30,
    );

    // Try to include scoring info from submissions for this session if present
    const submissions = getSubmissionsForSession(sessionId);
    const latest = submissions[submissions.length - 1] || null;
    const examScore = latest?.score ?? null;
    const technicalScore = latest?.technicalScore ?? null;
    const reasoningScore = latest?.reasoningScore ?? null;
    const tabSwitches = typeof latest?.tabSwitches === "number" ? latest.tabSwitches : 0;

    let explanation = "";

    // Prefer delegating the human-readable explanation to the FastAPI backend.
    try {
      const backendRes = await fetch(`${BACKEND_URL}/ai/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          score: typeof examScore === "number" ? examScore : score,
          technicalScore,
          reasoningScore,
          tabSwitches,
        }),
      });
      if (backendRes.ok) {
        const data = await backendRes.json();
        if (data && data.ok && typeof data.explanation === "string") {
          explanation = data.explanation;
        }
      }
    } catch (e) {
      // if backend is offline, fall back to local heuristic message
    }

    if (!explanation) {
      if (!suspicious && score >= 75) {
        explanation =
          "Candidate maintained stable focus, camera captures were consistent, and no multiple faces were detected. Session appears clean.";
      } else if (!suspicious && score < 75) {
        explanation =
          "Minor irregularities detected in focus or camera activity, but not enough to flag the session as suspicious. Recommend manual glance at logs if this is a critical role.";
      } else if (suspicious && multiFaceOccurrences > 0) {
        explanation =
          "Multiple faces were detected in the frame during the assessment. This suggests possible external assistance. Review captured images and timeline carefully.";
      } else if (suspicious && visibilityEvents > 2) {
        explanation =
          "Frequent tab switching or window focus loss was observed. Candidate may have been looking up answers or referencing other material.";
      } else if (suspicious && captures < 1) {
        explanation =
          "Very few or no camera captures were recorded during the session. This weakens the reliability of the assessment and should be treated with caution.";
      } else {
        explanation =
          "Proctoring engine detected unusual behavior. Review logs and captured frames for a final hiring decision.";
      }
    }

    const report = {
      sessionId,
      visibilityEvents,
      captures,
      multiFaceOccurrences,
      suspicious,
      score,
      explanation,
    };

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
