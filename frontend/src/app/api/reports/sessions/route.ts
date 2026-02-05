import { NextResponse } from "next/server";
import { getDistinctSessions, getAllSubmissions, getJobs } from "../../../../lib/db";

export async function GET() {
  try {
    const sessions = getDistinctSessions();
    const subs = getAllSubmissions();
    const jobs = getJobs();

    const details = sessions.map((sid) => {
      const related = subs.filter((s) => s.sessionId === sid);
      const latest = related[related.length - 1] || null;
      const job = latest?.jobId ? jobs.find((j: any) => j.id === latest.jobId) : null;
      return {
        sessionId: sid,
        jobId: latest?.jobId || null,
        jobTitle: job ? job.title : latest?.jobId || "Unknown job",
        candidateUsername: latest?.candidateUsername || null,
        created_at: latest?.created_at || null,
        passed: typeof latest?.passed === "boolean" ? latest.passed : null,
        flagged:
          (typeof latest?.tabSwitches === "number" && latest.tabSwitches > 1) ||
          (latest?.proctorFlags && latest.proctorFlags.multiFaceDetected) ||
          false,
      };
    });

    return NextResponse.json({ ok: true, sessions: details });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
