"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  filename: string;
  matchedSkills: string[];
  skillsMatched: number;
  requiredSkills: string[];
  detectedExp: number;
  minExp: number;
  score: number;
  aiConfidence: number;
  aiSummary: string;
  extraRequirements: string;
};

export default function ShortlistPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [requiredSkills, setRequiredSkills] = useState("");
  const [extraRequirements, setExtraRequirements] = useState("");
  const [minExp, setMinExp] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [topN, setTopN] = useState(10);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setAuthorized(false);
      router.replace("/");
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.user && j.user.role === "recruiter") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          router.replace("/");
        }
      })
      .catch(() => {
        setAuthorized(false);
        router.replace("/");
      });
  }, []);

  const shortlist = useMemo(() => results.slice(0, topN), [results, topN]);

  async function runShortlist() {
    if (!files.length) return;
    setLoading(true);
    const fd = new FormData();
    for (const f of files) fd.append("resumes", f);
    fd.append("requiredSkills", requiredSkills);
    fd.append("extraRequirements", extraRequirements);
    fd.append("minExp", String(minExp || 0));

    const res = await fetch("/api/recruiter/shortlist", {
      method: "POST",
      body: fd,
    });
    const j = await res.json();
    if (j.ok) setResults(j.results || []);
    setLoading(false);
  }

  function exportCsv() {
    const rows = [
      ["filename", "score", "skillsMatched", "detectedExp", "aiConfidence", "matchedSkills", "aiSummary"],
      ...shortlist.map((r) => [
        r.filename,
        String(r.score),
        String(r.skillsMatched),
        String(r.detectedExp),
        String(r.aiConfidence || 0),
        (r.matchedSkills || []).join("|"),
        (r.aiSummary || "").replace(/\n/g, " "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hireo-shortlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authorized === false) {
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a recruiter.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="section-title">Bulk AI Shortlisting</div>
        <div className="small muted">
          Upload candidate resumes, define required skills and extra criteria,
          then generate a ranked shortlist.
        </div>

        <div className="mt-4 grid">
          <div>
            <label className="small muted">Required skills (comma separated)</label>
            <input
              className="form-input mt-1"
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="Java, React, SQL, Python"
            />
          </div>
          <div>
            <label className="small muted">Extra requirements (optional)</label>
            <textarea
              className="form-input mt-1"
              rows={3}
              value={extraRequirements}
              onChange={(e) => setExtraRequirements(e.target.value)}
              placeholder="Example: experience in finance domain, strong communication"
            />
          </div>
          <div>
            <label className="small muted">Minimum experience (years)</label>
            <input
              className="form-input mt-1"
              type="number"
              min={0}
              value={minExp}
              onChange={(e) => setMinExp(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label className="small muted">Upload resumes (PDF/TXT/DOC/DOCX)</label>
            <input
              className="form-input mt-1"
              type="file"
              multiple
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <div className="small muted mt-2">
              {files.length ? `${files.length} files selected` : "No files selected"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={runShortlist} disabled={loading}>
            {loading ? "Analyzing..." : "Run AI Shortlist"}
          </button>
          {results.length > 0 && (
            <button className="btn btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <div className="section-title">Shortlisted Candidates</div>
          <div className="small muted">
            Showing top{" "}
            <input
              type="number"
              min={1}
              max={results.length}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value || 1))}
              style={{ width: 80, marginLeft: 6 }}
            />{" "}
            out of {results.length}
          </div>

          <div className="grid mt-3">
            {shortlist.map((r, i) => (
              <div key={`${r.filename}-${i}`} className="feature-card">
                <div className="font-medium">{r.filename}</div>
                <div className="small muted mt-1">
                  Score: <strong>{r.score}</strong> • Skills matched:{" "}
                  <strong>{r.skillsMatched}</strong>
                </div>
                <div className="small muted mt-1">
                  Experience: {r.detectedExp} yrs (min {r.minExp})
                </div>
                <div className="small mt-2">
                  <strong>Matched skills:</strong>{" "}
                  {(r.matchedSkills || []).join(", ") || "—"}
                </div>
                {r.aiSummary && (
                  <div className="small muted mt-2">
                    <strong>AI summary:</strong> {r.aiSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
