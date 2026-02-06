"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ProfileViewPage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === "string" ? params.username : "";
  const [profile, setProfile] = useState<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

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
        } else setAuthorized(false);
      })
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/profiles/${encodeURIComponent(username)}`,
        );
        const data = await res.json();
        setProfile(data?.profile || null);
      } catch {
        setProfile(null);
      }
    })();
  }, [username]);

  if (authorized === false) {
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a recruiter.
      </div>
    );
  }

  return (
    <div className="card">
      <div className="font-medium">Candidate Profile</div>
      {!profile ? (
        <div className="muted small mt-2">No profile found for {username}.</div>
      ) : (
        <div className="mt-3">
          <div className="text-lg font-semibold">
            {profile.fullName || profile.username || username}
          </div>
          <div className="muted small">{profile.location || "Location: â€”"}</div>

          {profile.bio && (
            <div className="small mt-2">
              <strong>Bio:</strong> {profile.bio}
            </div>
          )}
          {typeof profile.experience === "number" && (
            <div className="small mt-2">
              <strong>Experience:</strong> {profile.experience} years
            </div>
          )}
          <div className="small mt-2">
            <strong>Skills:</strong>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {(profile.skills || []).length === 0 && (
                <div className="muted small">No skills listed.</div>
              )}
              {(profile.skills || []).map((s: string, ix: number) => (
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
            </div>
          </div>

          {profile.resumeFilename && (
            <div className="small mt-3">
              <strong>Resume:</strong> {profile.resumeFilename}
              {profile.resumeBase64 && (
                <a
                  className="btn ml-2"
                  href={`data:application/octet-stream;base64,${profile.resumeBase64}`}
                  download={profile.resumeFilename || "resume"}
                >
                  Download
                </a>
              )}
            </div>
          )}
          {profile.resumeText && (
            <div className="small mt-3">
              <strong>Resume excerpt:</strong>
              <div className="muted mt-1">
                {(profile.resumeText || "").slice(0, 300)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
