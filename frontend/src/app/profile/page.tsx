"use client";
import React, { useEffect, useMemo, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function parseSkills(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [skillsInput, setSkillsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

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
          setUser(j.user);
        } else setAuthorized(false);
      })
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/profiles/${encodeURIComponent(user.username)}`,
        );
        const data = await res.json();
        const p = data?.profile || { username: user.username };
        setProfile(p);
        setSkillsInput((p.skills || []).join(", "));
      } catch {
        setProfile({ username: user.username });
      }
    })();
  }, [user?.username]);

  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      try {
        const res = await fetch("/api/reports/sessions");
        if (!res.ok) return;
        const data = await res.json();
        const all = data.sessions || [];
        const mine = all.filter(
          (s: any) => s.candidateUsername === user.username,
        );
        const total = mine.length;
        const passed = mine.filter((s: any) => s.passed === true).length;
        const flagged = mine.filter((s: any) => s.flagged === true).length;
        const recent = mine
          .slice()
          .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))
          .slice(0, 6);
        setStats({ total, passed, flagged, recent });
      } catch {
        // ignore
      }
    })();
  }, [user?.username]);

  const skillTags = useMemo(() => parseSkills(skillsInput), [skillsInput]);

  async function saveProfile() {
    if (!user?.username) return;
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        username: user.username,
        fullName: profile?.fullName || "",
        location: profile?.location || "",
        bio: profile?.bio || "",
        experience: Number(profile?.experience || 0) || 0,
        skills: skillTags,
        updatedAt: Date.now(),
      };
      const res = await fetch(
        `${BACKEND_URL}/profiles/${encodeURIComponent(user.username)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (data?.profile) setProfile(data.profile);
      setStatus("Profile saved.");
    } catch {
      setStatus("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadResume(file: File) {
    if (!user?.username) return;
    setUploading(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      fd.append("username", user.username);
      const res = await fetch("/api/profile/uploadResume", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data?.profile) setProfile(data.profile);
      setStatus("Resume stored. It will auto-check during tests.");
    } catch {
      setStatus("Resume upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (authorized === false) {
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a candidate.
      </div>
    );
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="font-medium mb-2">Candidate Profile</div>
        <div className="small muted">
          Keep your skills and resume updated. This profile is used to auto-check
          requirements during tests.
        </div>

        <div className="mt-3">
          <label className="small muted">Full name</label>
          <input
            className="form-input mt-1"
            value={profile?.fullName || ""}
            onChange={(e) =>
              setProfile((p: any) => ({ ...p, fullName: e.target.value }))
            }
          />
        </div>

        <div className="mt-3">
          <label className="small muted">Location</label>
          <input
            className="form-input mt-1"
            value={profile?.location || ""}
            onChange={(e) =>
              setProfile((p: any) => ({ ...p, location: e.target.value }))
            }
          />
        </div>

        <div className="mt-3">
          <label className="small muted">Experience (years)</label>
          <input
            className="form-input mt-1"
            type="number"
            min={0}
            value={profile?.experience ?? ""}
            onChange={(e) =>
              setProfile((p: any) => ({
                ...p,
                experience: e.target.value,
              }))
            }
          />
        </div>

        <div className="mt-3">
          <label className="small muted">Skills (comma separated)</label>
          <input
            className="form-input mt-1"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="Java, React, SQL, Python"
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {skillTags.map((s, ix) => (
              <div
                key={ix}
                style={{
                  padding: "6px 8px",
                  background: "rgba(37,99,235,0.06)",
                  borderRadius: 8,
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                {s}
              </div>
            ))}
            {skillTags.length === 0 && (
              <div className="small muted">No skills added yet.</div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="small muted">Bio</label>
          <textarea
            className="form-input mt-1"
            rows={4}
            value={profile?.bio || ""}
            onChange={(e) =>
              setProfile((p: any) => ({ ...p, bio: e.target.value }))
            }
          />
        </div>

        <div className="mt-4 flex gap-2 items-center">
          <button className="btn" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
          {status && <div className="small muted">{status}</div>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <div className="font-medium mb-2">Resume</div>
          <div className="small muted">
            Upload once here. The test page will auto-use this resume and your
            profile skills for requirement checks.
          </div>
          <div className="mt-3">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadResume(f);
              }}
            />
          </div>
          {profile?.resumeFilename && (
            <div className="small muted mt-2">
              Stored resume: <strong>{profile.resumeFilename}</strong>
            </div>
          )}
          {uploading && <div className="small muted mt-2">Uploading...</div>}
        </div>

        <div className="card">
          <div className="font-medium mb-2">Analytics</div>
          {!stats ? (
            <div className="small muted">No attempts yet.</div>
          ) : (
            <>
              <div className="small muted">
                Attempts: <strong>{stats.total}</strong> â€¢ Passed:{" "}
                <strong>{stats.passed}</strong> â€¢ Flagged:{" "}
                <strong>{stats.flagged}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                  marginTop: 10,
                  height: 60,
                }}
              >
                {(stats.recent || []).map((r: any, i: number) => {
                  const height = r.passed ? 50 : r.flagged ? 20 : 35;
                  const color = r.flagged
                    ? "#ef4444"
                    : r.passed
                      ? "#22c55e"
                      : "#f59e0b";
                  return (
                    <div
                      key={i}
                      title={r.jobTitle || "Attempt"}
                      style={{
                        width: 18,
                        height,
                        background: color,
                        borderRadius: 6,
                      }}
                    />
                  );
                })}
                {(stats.recent || []).length === 0 && (
                  <div className="small muted">No recent attempts yet.</div>
                )}
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>
                Green = passed, Red = flagged, Amber = failed.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
