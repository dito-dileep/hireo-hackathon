import { NextResponse } from "next/server";
import { getAllSubmissions, getJobs } from "../../../../lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobIdFilter = url.searchParams.get("jobId");

    const subs = getAllSubmissions();
    const jobs = getJobs();

    const byJob: Record<
      string,
      { jobId: string; jobTitle: string; total: number; passed: number; flagged: number }
    > = {};

    for (const s of subs) {
      const jobId = s.jobId || "unknown";
      if (jobIdFilter && jobIdFilter !== "all" && jobId !== jobIdFilter) continue;
      if (!byJob[jobId]) {
        const job = jobs.find((j: any) => j.id === jobId);
        byJob[jobId] = {
          jobId,
          jobTitle: job ? job.title : jobId,
          total: 0,
          passed: 0,
          flagged: 0,
        };
      }
      const entry = byJob[jobId];
      entry.total += 1;
      if (s.passed) entry.passed += 1;
      const flagged =
        !s.passed ||
        (typeof s.tabSwitches === "number" && s.tabSwitches > 1);
      if (flagged) entry.flagged += 1;
    }

    const overview = Object.values(byJob);

    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

