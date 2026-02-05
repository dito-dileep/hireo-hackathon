"use client";
import React, { useEffect, useState } from "react";

export default function ReportsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | "all">("all");
  const [overview, setOverview] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"latest" | "flagged">("latest");
  const [filterMode, setFilterMode] = useState<"all" | "flagged" | "passed">(
    "all",
  );

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setAuthorized(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.user && j.user.role === "recruiter") {
          setAuthorized(true);
          fetchSessions();
          fetchJobs();
        } else setAuthorized(false);
      })
      .catch(() => setAuthorized(false));
  }, []);

  async function fetchSessions() {
    // API requires sessionId so we instead fetch distinct sessions from a helper route
    const ds = await fetch("/api/reports/sessions");
    if (ds.ok) {
      const d = await ds.json();
      setSessions(d.sessions || []);
      if (!selected && d.sessions && d.sessions.length > 0) {
        const latest = d.sessions
          .slice()
          .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))[0];
        if (latest) {
          setSelected(latest.sessionId);
          openSession(latest.sessionId);
        }
      }
    }
  }

  async function fetchJobs() {
    try {
      const r = await fetch("/api/jobs");
      if (r.ok) {
        const j = await r.json();
        setJobs(j.jobs || []);
        await fetchOverview("all");
      }
    } catch (e) {
      // ignore
    }
  }

  async function fetchOverview(jobId: string | "all") {
    try {
      const qs = jobId && jobId !== "all" ? `?jobId=${encodeURIComponent(jobId)}` : "";
      const res = await fetch(`/api/reports/overview${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setOverview(data.overview || []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchOverview(selectedJobId);
     
  }, [selectedJobId]);

  const filteredSessions = sessions
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay =
        `${s.candidateUsername || ""} ${s.jobTitle || ""} ${s.sessionId || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .filter((s) => {
      if (filterMode === "flagged") return !!s.flagged;
      if (filterMode === "passed") return s.passed === true;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "flagged") {
        const af = a.flagged ? 1 : 0;
        const bf = b.flagged ? 1 : 0;
        if (af !== bf) return bf - af;
      }
      const at = a.created_at || 0;
      const bt = b.created_at || 0;
      return bt - at;
    });

  async function openSession(s: string) {
    setSelected(s);
    const r = await fetch(`/api/proctor?sessionId=${encodeURIComponent(s)}`);
    const jr = await r.json();
    setLogs(jr.logs || []);
    const subsRes = await fetch(
      `/api/reports/submissions?sessionId=${encodeURIComponent(s)}`,
    );
    if (subsRes.ok) {
      const sj = await subsRes.json();
      setSubmissions(sj.submissions || []);
    } else setSubmissions([]);
    const ar = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: s }),
    });
    const aj = await ar.json();
    setReport(aj.report || null);
  }

  // Local helper to summarise per-question performance from stored answers.
  function buildBreakdown(sub: any) {
    const answers = sub.answers || {};
    const details: string[] = [];

    // MCQ questions 1 & 2
    const mcqKey: Record<number, number> = { 1: 1, 2: 0 };
    let mcqCorrect = 0;
    let mcqTotal = 0;
    for (const k of Object.keys(mcqKey)) {
      const id = Number(k);
      mcqTotal += 1;
      if (Number(answers[id]) === mcqKey[id]) mcqCorrect += 1;
    }
    details.push(`Logic MCQs: ${mcqCorrect}/${mcqTotal} correct.`);

    // Aptitude Q3
    if (answers[3] !== undefined) {
      const numeric = Number(String(answers[3]).replace(/[^\d.]/g, ""));
      if (!Number.isNaN(numeric)) {
        const diff = Math.abs(numeric - 45);
        if (diff === 0) {
          details.push("Aptitude: exact correct speed (45 km/h).");
        } else if (diff <= 3) {
          details.push("Aptitude: close numeric answer.");
        } else {
          details.push("Aptitude: off from expected 45 km/h.");
        }
      }
    }

    // Coding Q4
    if (answers[4] !== undefined) {
      const code = String(answers[4]).toLowerCase();
      const hasLoop =
        code.includes("for") || code.includes("while") || code.includes("reduce");
      const usesAcc =
        code.includes("sum") || code.includes("total") || code.includes("+=");
      const returns = code.includes("return");
      if (hasLoop && usesAcc && returns) {
        details.push("Coding: idiomatic loop + accumulator with clear return.");
      } else if (hasLoop || usesAcc) {
        details.push("Coding: partial logic present, could be more complete.");
      } else {
        details.push("Coding: answer did not clearly implement an array sum.");
      }
    }

    // Communication / text Q5
    if (answers[5] !== undefined) {
      const text = String(answers[5]);
      if (text.length > 80) {
        details.push("Communication: detailed debugging explanation provided.");
      } else if (text.length > 30) {
        details.push("Communication: brief but reasonable debugging explanation.");
      } else {
        details.push("Communication: very short response; limited signal.");
      }
    }

    // Workstyle slider Q6
    if (answers[6] !== undefined) {
      const lvl = Number(answers[6]);
      if (!Number.isNaN(lvl)) {
        details.push(`Workstyle: self-rated independence level ${lvl}/10.`);
      }
    }

    // Recruiter-added questions (if present)
    const extraKeys = Object.keys(answers).filter((k) =>
      String(k).startsWith("extra-"),
    );
    if (extraKeys.length > 0) {
      let detailed = 0;
      let short = 0;
      for (const k of extraKeys) {
        const text = String(answers[k] || "");
        if (text.length > 30) detailed += 1;
        else if (text.length > 0) short += 1;
      }
      details.push(
        `Extra questions: ${extraKeys.length} answered (${detailed} detailed, ${short} short).`,
      );
    }

    if (typeof sub.tabSwitches === "number") {
      details.push(`Integrity: ${sub.tabSwitches} tab/window switches recorded.`);
    }

    return details;
  }

  if (authorized === false)
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a recruiter.
      </div>
    );

  return (
    <div className="grid-2">
      <div className="card">
        <div className="font-medium mb-2">Filter & Sessions</div>
        <div className="small muted mb-2">
          Filter sessions by job and open any attempt to review integrity,
          scores, and logs.
        </div>
        <div className="mb-3">
          <label className="small muted">Job</label>
          <select
            className="form-input mt-1"
            value={selectedJobId}
            onChange={(e) =>
              setSelectedJobId(
                e.target.value === "all" ? "all" : e.target.value,
              )
            }
          >
            <option value="all">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="small muted">Search</label>
          <input
            className="form-input mt-1"
            placeholder="Candidate, job, or session…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="small muted">Sort</label>
          <select
            className="form-input mt-1"
            value={sortMode}
            onChange={(e) =>
              setSortMode(e.target.value as "latest" | "flagged")
            }
          >
            <option value="latest">Latest first</option>
            <option value="flagged">Flagged first</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="small muted">Quick Filter</label>
          <select
            className="form-input mt-1"
            value={filterMode}
            onChange={(e) =>
              setFilterMode(e.target.value as "all" | "flagged" | "passed")
            }
          >
            <option value="all">All</option>
            <option value="flagged">Flagged only</option>
            <option value="passed">Passed only</option>
          </select>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="font-medium mb-1">Job overview</div>
          {overview.length === 0 ? (
            <div className="muted small">No submissions yet.</div>
          ) : (
            <div className="small">
              {overview.map((o) => (
                <div key={o.jobId} style={{ marginTop: 6 }}>
                  <div className="font-medium small">{o.jobTitle}</div>
                  <div className="muted small">
                    Candidates: <strong>{o.total}</strong> • Passed:{" "}
                    <strong>{o.passed}</strong> • Flagged:{" "}
                    <strong>{o.flagged}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {filteredSessions.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => openSession(s.sessionId)}
              className="text-left px-3 py-2 rounded card"
            >
              <div className="font-medium">
                {s.candidateUsername || "Unknown candidate"}
                {s.flagged && (
                  <span style={{ marginLeft: 8, color: "#ef4444" }}>
                    • Flagged
                  </span>
                )}
              </div>
              <div className="small muted">
                {s.jobTitle || "Unknown job"} •{" "}
                {s.created_at
                  ? new Date(s.created_at).toLocaleString()
                  : "Unknown time"}
              </div>
              <div className="small muted">
                Session: {String(s.sessionId).slice(0, 16)}...
              </div>
            </button>
          ))}
          {filteredSessions.length === 0 && <div className="muted">No sessions</div>}
        </div>
      </div>
      <div>
        <div className="card mb-4">
          <div className="font-medium">
            Session: {selected || "—"}
          </div>
          {submissions[0] && (
            <div className="small mt-1 muted">
              Candidate:{" "}
              <strong>{submissions[0].candidateUsername || "Unknown"}</strong>{" "}
              {submissions[0].jobId && (
                <>
                  • Job:{" "}
                  <strong>
                    {jobs.find((j) => j.id === submissions[0].jobId)?.title ||
                      submissions[0].jobId}
                  </strong>
                </>
              )}
            </div>
          )}
          {report && (
            <div className="mt-2 muted">
              AI Integrity Score: <strong>{report.score}</strong> / 100 —{" "}
              Suspicious: <strong>{report.suspicious ? "Yes" : "No"}</strong>
              {report.explanation && (
                <div className="mt-2 small">
                  <strong>Why:</strong> {report.explanation}
                </div>
              )}
            </div>
          )}
          {submissions.length > 0 ? (
            <div className="mt-2">
              <div className="font-semibold mb-2">Candidate Result</div>
              <div className="flex gap-2 mb-2">
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    if (!selected) return;
                    const res = await fetch(
                      `/api/reports/pdf?sessionId=${encodeURIComponent(selected)}`,
                    );
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `hireo-report-${selected}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download PDF report
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    if (!selected) return;
                    const res = await fetch(
                      `/api/reports/resume?sessionId=${encodeURIComponent(
                        selected,
                      )}`,
                    );
                    if (!res.ok) return;
                    const disposition = res.headers.get("Content-Disposition");
                    let filename = "resume";
                    if (disposition) {
                      const match =
                        /filename="([^"]+)"/i.exec(disposition) || undefined;
                      if (match && match[1]) filename = match[1];
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download uploaded resume
                </button>
              </div>
              {submissions.map((s, ix) => (
                <div key={ix} className="mt-1 card">
                  <div className="font-medium">
                    {s.candidateUsername || "Unknown candidate"}
                  </div>
                  <div className="small mt-1">
                    Score: <strong>{s.score ?? "—"}</strong> —{" "}
                    <strong>{s.passed ? "Passed" : "Failed"}</strong>
                  </div>
                  {typeof s.technicalScore === "number" && (
                    <div className="small">
                      Technical: <strong>{s.technicalScore}</strong> / 100
                    </div>
                  )}
                  {typeof s.reasoningScore === "number" && (
                    <div className="small">
                      Reasoning: <strong>{s.reasoningScore}</strong> / 100
                    </div>
                  )}
                  {s.aiAll && (
                    <div className="small">
                      AI Overall: <strong>{s.aiAll.overallScore}</strong> / 100
                    </div>
                  )}
                  <div className="small">
                    Integrity:{" "}
                    <strong>
                      {typeof s.tabSwitches === "number" && s.tabSwitches > 1
                        ? "Flagged"
                        : "Clean"}
                    </strong>
                  </div>
                  {s.proctorFlags?.multiFaceDetected && (
                    <div className="small" style={{ color: "#ef4444" }}>
                      Integrity: multi-face detected
                    </div>
                  )}
                  {s.explanation && (
                    <div className="small mt-1">
                      <strong>Decision rationale:</strong> {s.explanation}
                    </div>
                  )}
                  {s.extraAi && (
                    <div className="small mt-1">
                      <strong>AI Match Score:</strong>{" "}
                      <span>{s.extraAi.overallScore}</span>{" "}
                      {s.extraAi.summary && (
                        <span className="muted">— {s.extraAi.summary}</span>
                      )}
                    </div>
                  )}
                  <div className="small mt-2">
                    <strong>Breakdown:</strong>
                    <ul className="small" style={{ marginTop: 4, paddingLeft: 18 }}>
                      {buildBreakdown(s).map((line, i2) => (
                        <li key={i2}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  {(() => {
                    const job = jobs.find((j) => j.id === s.jobId);
                    const extraQs = (job?.extraQuestions || []) as string[];
                    const extraKeys = Object.keys(s.answers || {}).filter((k) =>
                      String(k).startsWith("extra-"),
                    );
                    if (!extraQs.length && !extraKeys.length) return null;
                    return (
                      <div className="small mt-2">
                        <strong>Extra Questions:</strong>
                        <div className="small" style={{ marginTop: 4 }}>
                          {(extraQs.length ? extraQs : extraKeys.map((k) => k)).map(
                            (q: string, i: number) => {
                              const key = extraQs.length ? `extra-${i}` : q;
                              const ans =
                                (s.answers && s.answers[key]) !== undefined
                                  ? String(s.answers[key])
                                  : "";
                              const expected =
                                (job?.extraExpectedAnswers &&
                                  job.extraExpectedAnswers[i]) ||
                                "";
                              const aiPer =
                                s.extraAi && s.extraAi.perQuestion
                                  ? s.extraAi.perQuestion[i]
                                  : null;
                              return (
                                <div key={i} style={{ marginTop: 6 }}>
                                  <div className="font-medium">
                                    Q{i + 1}: {extraQs.length ? q : "Extra question"}
                                  </div>
                                  <div className="muted">
                                    Answer: {ans || "—"}
                                  </div>
                                  {expected && (
                                    <div className="muted">
                                      Expected: {expected}
                                    </div>
                                  )}
                                  {aiPer && (
                                    <div className="muted">
                                      AI score: {aiPer.score} — {aiPer.rationale}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {s.aiAll && s.aiAll.perQuestion && (
                    <div className="small mt-2">
                      <strong>AI Grading (All Questions):</strong>
                      <div className="small" style={{ marginTop: 4 }}>
                        {s.aiAll.perQuestion.map((p: any, i: number) => (
                          <div key={i} style={{ marginTop: 6 }}>
                            <div className="font-medium">
                              {p.id}: {p.correct ? "Correct" : "Needs work"}
                            </div>
                            <div className="muted">
                              Score: {p.score} — {p.rationale}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted mt-2">
              No submissions for this session yet
            </div>
          )}
          {report &&
            (report.suspicious ||
              (submissions[0] && submissions[0].passed === false)) && (
              <div className="mt-3 p-3 bg-red-900/40 rounded text-sm">
                Candidate flagged:{" "}
                {report.suspicious
                  ? "Proctoring AI flagged suspicious behavior."
                  : ""}{" "}
                {submissions[0] && submissions[0].passed === false
                  ? "Candidate failed the test."
                  : ""}
              </div>
            )}
        </div>
        <div className="card">
          <div className="font-medium mb-2">Proctoring timeline</div>
          <div className="timeline">
            {logs.map((l, ix) => {
              const t = l.type;
              let label = t;
              let dotClass = "timeline-dot";
              if (t === "capture") {
                label = "Camera capture";
                dotClass += " secondary";
              } else if (t === "visibility") {
                label = "Tab visibility change";
                dotClass += " alert";
              } else if (t === "window") {
                label =
                  l.payload && l.payload.state === "blur"
                    ? "Window blur"
                    : "Window focus";
                dotClass += " alert";
              } else if (t === "unload") {
                label = "Tab close/unload";
                dotClass += " muted";
              }
              return (
                <div key={ix} className="timeline-item">
                  <div className={dotClass} />
                  <div className="muted small">
                    {new Date(l.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-sm">{label}</div>
                  {l.payload && (
                    <pre className="muted mt-1">
                      {JSON.stringify(l.payload).slice(0, 120)}
                    </pre>
                  )}
                  {l.payload &&
                    (l.payload.face_count !== undefined ||
                      l.payload.count !== undefined) && (
                      <div className="small muted">
                        Faces:{" "}
                        {l.payload.face_count !== undefined
                          ? l.payload.face_count
                          : l.payload.count}
                      </div>
                    )}
                  {l.image_base64 && (
                    <img
                      src={`data:image/jpeg;base64,${l.image_base64}`}
                      alt="capture"
                      className="mt-2 max-w-xs border"
                    />
                  )}
                </div>
              );
            })}
            {logs.length === 0 && (
              <div className="muted small">No proctoring events recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
