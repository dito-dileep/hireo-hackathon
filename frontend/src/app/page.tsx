"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setUser(j.user);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="hero card">
        <div style={{ flex: 1 }}>
          <div className="tag">Enterprise Hiring Intelligence</div>
          <div className="title" style={{ marginTop: 10 }}>
            HIREO - Enterprise proctored hiring for recruiters and candidates
          </div>
          <div className="lead" style={{ marginTop: 10 }}>
            A single platform for job posting, candidate screening, and
            defensible AI scoring. Built for organizations that need integrity,
            speed, and clarity - with candidate-friendly experiences.
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {user?.role === "recruiter" && (
              <>
                <Link href="/recruiter" className="btn">
                  Post Job
                </Link>
                <Link href="/reports" className="btn btn-ghost">
                  View Reports
                </Link>
              </>
            )}
            {user?.role === "candidate" && (
              <>
                <Link href="/candidate" className="btn">
                  Find Jobs
                </Link>
                <Link href="/reports" className="btn btn-ghost">
                  View Reports
                </Link>
              </>
            )}
            {!user && (
              <>
                <Link href="/auth/login" className="btn">
                  Login
                </Link>
                <Link href="/auth/register" className="btn btn-ghost">
                  Register
                </Link>
              </>
            )}
          </div>
          <div className="hero-metrics">
            <div className="metric-card">
              <div className="metric-label">Integrity Signals</div>
              <div className="metric-value">Camera, focus, multi-face</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">AI Scoring</div>
              <div className="metric-value">Explainable per question output</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Resume Match</div>
              <div className="metric-value">Skills + semantic AI checks</div>
            </div>
          </div>
        </div>
        <div>
          <div className="card-soft center">
            <div className="section-title">Why companies choose HIREO</div>
            <div className="small muted">
              Recruiter-grade evidence and a clean candidate experience. Every
              decision is backed by scoring rationale, integrity logs, and AI
              summaries.
            </div>
            <div style={{ marginTop: 14 }} className="feature-grid">
              <div className="feature-card">
                <div className="section-title">AI Guardrails</div>
                <div className="small muted">
                  Detects suspicious behavior and explains the outcome.
                </div>
              </div>
              <div className="feature-card">
                <div className="section-title">Proctor Timeline</div>
                <div className="small muted">
                  Every signal recorded with time and evidence.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Built for recruiters and candidates</div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="tag">AI Resume Intelligence</div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Automated skill extraction and match confidence with human-readable
              rationale.
            </div>
          </div>
          <div className="feature-card">
            <div className="tag">Question Bank + Custom</div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Mix structured logic, coding, and recruiter-added questions with
              flexible time limits.
            </div>
          </div>
          <div className="feature-card">
            <div className="tag">Recruiter Reports</div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Role-based reporting with integrity badges, AI scoring, and
              candidate profile links.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
