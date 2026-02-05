"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  description: string;
  skills?: string[];
  minExp?: number;
  company?: string;
  vacancyRemaining?: number;
  vacancyTotal?: number;
};

export default function CandidatePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("fetchJobs error", err);
    }
  }

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
        if (j.ok && j.user && j.user.role === "candidate") {
          setAuthorized(true);
          fetchJobs();
        } else setAuthorized(false);
      })
      .catch(() => setAuthorized(false));
  }, []);

  if (authorized === false)
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a candidate.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-semibold mb-2">Candidate — Available Tests</h2>
        <div className="muted small">Find tests posted by recruiters and take the proctored assessment.</div>
      </div>

      <div className="grid">
        {jobs.map((j) => (
          <div key={j.id} className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div className="font-medium">{j.title}</div>
                <div className="muted small">{j.company || 'Unknown company'}</div>
              </div>
              <Link href={`/job/${j.id}`} className="btn">Start Test</Link>
            </div>
            <div className="muted small" style={{marginTop:8}}>{j.description}</div>
            {typeof j.vacancyRemaining === "number" && (
              <div className="muted small" style={{ marginTop: 6 }}>
                Seats left:{" "}
                <strong>
                  {j.vacancyRemaining}
                  {typeof j.vacancyTotal === "number" ? ` / ${j.vacancyTotal}` : ""}
                </strong>
              </div>
            )}
            <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap'}}>
              {(j.skills || []).map((s, idx) => (
                <div key={idx} style={{padding:'6px 8px', background:'rgba(37,99,235,0.06)', borderRadius:8, color:'var(--muted)', fontSize:12}}>{s}</div>
              ))}
              {typeof j.minExp === 'number' && (
                <div style={{padding:'6px 8px', background:'rgba(14,165,164,0.06)', borderRadius:8, color:'var(--muted)', fontSize:12}}>Min {j.minExp} yrs</div>
              )}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <div className="muted">No jobs yet</div>}
      </div>
    </div>
  );
}
