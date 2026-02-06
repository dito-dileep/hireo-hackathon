"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Proctor from "../../components/Proctor";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function normalizeText(s?: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillMatches(text: string, skill: string) {
  const t = text.toLowerCase();
  const s = skill.toLowerCase().trim();
  if (!s) return false;
  if (t.includes(s)) return true;
  try {
    const re = new RegExp(`\\b${escapeRegExp(s)}\\b`, "i");
    return re.test(text);
  } catch {
    return false;
  }
}

function questions() {
  return [
    {
      id: 1,
      q: "Quick logic check: What is 2 + 2?",
      type: "mcq",
      options: ["3", "4", "5"],
      ans: 1,
    },
    {
      id: 2,
      q: "General awareness: Capital of France?",
      type: "mcq",
      options: ["Paris", "Rome", "Berlin"],
      ans: 0,
    },
    {
      id: 3,
      q: "Aptitude: If a train goes 60km in 1 hour 20 minutes, what's its average speed (km/h)?",
      type: "short",
    },
    {
      id: 4,
      q: "Coding: Write a function that returns the sum of an array (just paste code).",
      type: "code",
    },
    {
      id: 5,
      q: "Communication: Briefly explain how you would debug a failing API in production.",
      type: "text",
    },
    {
      id: 6,
      q: "Workstyle slider: On a scale of 1–10, how comfortable are you working independently?",
      type: "short",
    },
  ];
}

export default function JobTest() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === "string" ? params.id : "";
  const [job, setJob] = useState<any>(null);
  const qs = useMemo(() => questions(), []);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [codeText, setCodeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeCheck, setResumeCheck] = useState<any>(null);
  const [resumeCheckSource, setResumeCheckSource] = useState<
    "profile" | "upload" | null
  >(null);
  const [resumeText, setResumeText] = useState<string>("");
  const [aiQuestions, setAiQuestions] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiSeedRef = useRef<string>("");
  const [aiAttempts, setAiAttempts] = useState(0);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    aiScore?: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [tabWarning, setTabWarning] = useState<string | null>(null);
  const [integrityFail, setIntegrityFail] = useState<string | null>(null);
  const lastSwitchRef = useRef(0);
  const suppressSwitchUntilRef = useRef(0);
  const [multiFaceDetected, setMultiFaceDetected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileDialogOpenRef = useRef(false);
  const permissionPromptRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // default 15 minutes
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const autoSubmittedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [sessionId] = useState(() => `sess-${jobId}-${Date.now()}`);

  useEffect(() => {
    (async ()=>{
      try{
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setAuthorized(false);
          return;
        }
        const me = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
        if (!me.ok || me.user.role !== "candidate") {
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        const r = await fetch('/api/jobs');
        if (r.ok){ const j = await r.json(); const found = (j.jobs||[]).find((x:any)=> x.id === jobId); if (found) setJob(found); }
        if (token) {
          try {
            const me = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            if (me?.ok && me?.user?.username) {
              const pr = await fetch(
                `${BACKEND_URL}/profiles/${encodeURIComponent(
                  me.user.username,
                )}`,
              );
              const pj = await pr.json();
              if (pj?.profile) {
                setProfile(pj.profile);
                if (pj.profile.resumeText) {
                  setResumeText(String(pj.profile.resumeText));
                } else if (pj.profile.skills || pj.profile.bio) {
                  const sk = Array.isArray(pj.profile.skills)
                    ? pj.profile.skills.join(", ")
                    : "";
                  const bio = pj.profile.bio || "";
                  const exp =
                    typeof pj.profile.experience === "number"
                      ? `Experience: ${pj.profile.experience} years.`
                      : "";
                  setResumeText(`Skills: ${sk}. ${exp} ${bio}`.trim());
                }
              }
            }
          } catch {}
        }
      }catch(e){}
    })();
  }, [jobId]);

  useEffect(() => {
    if (!job || !profile) return;
    if (resumeCheckSource === "upload") return;
    const requiredSkills: string[] = (job.skills || [])
      .map((s: string) => String(s).toLowerCase().trim())
      .filter(Boolean);
    const profileSkills: string[] = (profile.skills || [])
      .map((s: string) => String(s).toLowerCase().trim())
      .filter(Boolean);
    const resumeText = String(profile.resumeText || "");
    const rawText = `${profileSkills.join(" ")} ${resumeText}`;
    const norm = normalizeText(rawText);
    const matched: string[] = [];
    for (const sk of requiredSkills) {
      const skNorm = normalizeText(sk);
      if (profileSkills.includes(sk) || norm.includes(skNorm) || skillMatches(rawText, sk)) {
        matched.push(sk);
      }
    }
    const detectedExp = Number(profile.experience || 0) || 0;
    const skillsMatched = matched.length;
    const skillsOk =
      requiredSkills.length === 0 ||
      skillsMatched >= Math.max(1, Math.round(requiredSkills.length * 0.6));
    const expOk = detectedExp >= (Number(job.minExp) || 0);
    setResumeCheck({
      ok: true,
      source: "profile",
      skillsMatched,
      matchedSkills: matched,
      requiredSkills,
      detectedExp,
      skillsOk,
      expOk,
    });
    setResumeCheckSource("profile");
  }, [job, profile, resumeCheckSource]);

  useEffect(() => {
    if (!job) return;
    if (!resumeText) return;
    if (aiQuestions.length > 0 || aiLoading) return;
    (async () => {
      try {
        setAiLoading(true);
        setAiError(null);
        const seed = `${resumeText.length}:${resumeText.slice(0, 24)}:${resumeText.slice(-24)}`;
        if (aiSeedRef.current === seed) {
          setAiLoading(false);
          return;
        }
        aiSeedRef.current = seed;
        const res = await fetch("/api/ai/questions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resumeText,
            requiredSkills: job.skills || [],
            roleTitle: job.title || "",
            count: 3,
          }),
        });
        const j = await res.json();
        if (j.ok && Array.isArray(j.questions)) {
          setAiQuestions(j.questions);
        } else {
          setAiError(
            j?.error ||
              "AI question generation failed. Please try again.",
          );
        }
      } catch {}
      setAiLoading(false);
    })();
  }, [job, resumeText, aiQuestions.length, aiLoading, aiAttempts]);

  async function regenerateAiQuestions() {
    setAiQuestions([]);
    setAiError(null);
    aiSeedRef.current = "";
    setAiAttempts((c) => c + 1);
  }

  useEffect(() => {
    if (!job || started) return;
    const extraCount = Array.isArray(job.extraQuestions)
      ? job.extraQuestions.length
      : 0;
    const fallback = 15 + extraCount * 2;
    const base =
      typeof job.timeLimitMinutes === "number"
        ? job.timeLimitMinutes
        : fallback;
    setTimeLeft(base * 60);
  }, [job, started]);

  useEffect(() => {
    if (!started) return;
    function registerSwitch() {
      const now = Date.now();
      if (now < suppressSwitchUntilRef.current) return;
      if (permissionPromptRef.current) return;
      if (now - lastSwitchRef.current < 1000) return;
      lastSwitchRef.current = now;
      setTabSwitches((c) => {
        const next = c + 1;
        if (next === 1) {
          setTabWarning(
            "Warning: tab or window switch detected. Please stay on this test tab.",
          );
        } else if (next > 1) {
          setTabWarning(
            "Too many tab switches detected. This attempt will be automatically marked as failed for integrity reasons.",
          );
        }
        return next;
      });
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        registerSwitch();
      } else {
        suppressSwitchUntilRef.current = Date.now() + 500;
      }
    }

    function handleBlur() {
      if (document.visibilityState !== "visible") return;
      registerSwitch();
    }

    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // Suppress switch detection around fullscreen transitions
      suppressSwitchUntilRef.current = Date.now() + 1000;
      if (!fs) {
        // If a file picker triggered exit, don't count as a switch
        if (!fileDialogOpenRef.current && !permissionPromptRef.current) {
          setTabWarning(
            "Fullscreen exited. This will be marked as a tab/window switch.",
          );
          registerSwitch();
        }
      }
    }

    function handleResize() {
      // Ignore resize spikes from fullscreen transitions
      suppressSwitchUntilRef.current = Date.now() + 500;
    }

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
    };
  }, [started]);

  // simple countdown timer (visual only; does not auto-submit)
  useEffect(() => {
    if (!started) return;
    if (timeLeft <= 0) return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timeLeft, started]);

  // 2-minute warning banner
  useEffect(() => {
    if (!started) return;
    if (timeLeft > 0 && timeLeft <= 120) {
      setTimeWarning("2 minutes left — please finish and submit.");
    } else if (timeLeft > 120) {
      setTimeWarning(null);
    }
  }, [timeLeft, started]);

  // auto-submit when time expires
  useEffect(() => {
    if (!started) return;
    if (timeLeft !== 0) return;
    if (autoSubmittedRef.current) return;
    if (submitting || result) return;
    autoSubmittedRef.current = true;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, submitting, result, started]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      // Attempt fullscreen right before test starts
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setStarted(true);
      return;
    }
    const id = window.setInterval(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (!result) return;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, [result]);

  const pick = useCallback((qid: number, idx: number) => {
    setAnswers((a) => ({ ...a, [String(qid)]: idx }));
  }, []);

  async function submit() {
    const extraQs: string[] = Array.isArray(job?.extraQuestions)
      ? job.extraQuestions
      : job?.extraQuestion
        ? [job.extraQuestion]
        : [];
    if (aiQuestions.length === 0) {
      alert("AI questions are not ready yet. Please upload a resume and wait.");
      return;
    }
    if (extraQs.length) {
      for (let i = 0; i < extraQs.length; i++) {
        const key = `extra-${i}`;
        const extraAnswer = answers[key];
        if (!extraAnswer || String(extraAnswer).trim().length === 0) {
          alert("Please answer all additional questions before submitting.");
          return;
        }
      }
    }
    if (multiFaceDetected) {
      setIntegrityFail(
        "Multiple faces detected. This attempt will be marked as failed.",
      );
    }
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const payload = {
      jobId,
      sessionId,
      answers,
      aiQuestions,
      tabSwitches,
      proctorFlags: { multiFaceDetected },
    };
    setSubmitting(true);
    const res = await fetch("/api/jobs", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (j.ok) {
      setResult({ score: j.score, passed: j.passed, aiScore: j.aiScore });
      setTimeout(() => {
        router.push("/candidate");
      }, 2500);
    } else {
      alert("Submission failed. Please try again.");
    }
    setSubmitting(false);
  }

  async function uploadResumeAndCheck(fileOverride?: File | null) {
    const fileToUse = fileOverride || resumeFile;
    if (!fileToUse) {
      // open file picker for smoother UX
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    const fd = new FormData();
    fd.append("resume", fileToUse);
    fd.append("jobId", jobId);
    fd.append("sessionId", sessionId);
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setUploading(true);
    const res = await fetch("/api/jobs/uploadResume", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    });
    const j = await res.json();
    setResumeCheck(j);
    setResumeCheckSource("upload");
    if (j && j.resumeText) {
      setResumeText(String(j.resumeText));
    } else if (j && Array.isArray(j.matchedSkills)) {
      setResumeText(`Skills: ${j.matchedSkills.join(", ")}`);
    }
    // Force AI regeneration even if the resume text is unchanged.
    setAiQuestions([]);
    setAiError(null);
    aiSeedRef.current = "";
    setAiAttempts((c) => c + 1);
    if (j.ok && (!j.skillsOk || !j.expOk)) {
      alert(
        "Resume does not meet minimum requirements. Check the detected skills/experience.",
      );
    }
    setUploading(false);
  }

  return (
    <div className="space-y-6">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h2 className="text-2xl font-semibold">{job ? `${job.title}` : `Test — ${jobId}`}</h2>
          {job && <div className="muted small">{job.company}</div>}
        </div>
        <div className="small muted" style={{ textAlign: "right" }}>
          {(() => {
            const extraQs: string[] = Array.isArray(job?.extraQuestions)
              ? job.extraQuestions
              : job?.extraQuestion
                ? [job.extraQuestion]
                : [];
            const total = aiQuestions.length + extraQs.length;
            const answered = Object.keys(answers).filter((k) => {
              const v = answers[k];
              if (v === undefined || v === "") return false;
              return String(k).startsWith("ai-") || String(k).startsWith("extra-");
            }).length;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            return (
              <>
                <div>
                  Answered {answered}/{total}
                </div>
                <div>
                  Time left: {mins.toString().padStart(2, "0")}:
                  {secs.toString().padStart(2, "0")}
                </div>
              </>
            );
          })()}
        </div>
      </div>
      {timeWarning && (
        <div className="card" style={{ border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.08)" }}>
          <div className="font-medium">Time warning</div>
          <div className="small muted">{timeWarning}</div>
        </div>
      )}
      {!started && (
        <div className="card">
          <div className="font-medium">Before you start</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Review the job details, time limit, and integrity rules. The timer
            and proctoring begin when you click Start.
          </div>
          <div className="mt-3">
            <div className="small">
              <strong>Job:</strong> {job ? job.title : jobId}
            </div>
            {job?.company && (
              <div className="small">
                <strong>Company:</strong> {job.company}
              </div>
            )}
            {job?.description && (
              <div className="small" style={{ marginTop: 6 }}>
                <strong>Summary:</strong> {job.description}
              </div>
            )}
            {job && (job.skills?.length || typeof job.minExp === "number") ? (
              <div className="small" style={{ marginTop: 6 }}>
                <strong>Requirements:</strong>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {(job.skills || []).length === 0 && (
                    <div
                      style={{
                        padding: "6px 8px",
                        background: "rgba(37,99,235,0.06)",
                        borderRadius: 8,
                        color: "var(--muted)",
                        fontSize: 12,
                      }}
                    >
                      None
                    </div>
                  )}
                  {(job.skills || []).map((s: string, ix: number) => (
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
                  {typeof job.minExp === "number" && (
                    <div
                      style={{
                        padding: "6px 8px",
                        background: "rgba(14,165,164,0.06)",
                        borderRadius: 8,
                        color: "var(--muted)",
                        fontSize: 12,
                      }}
                    >
                      Min {job.minExp} yrs
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="small" style={{ marginTop: 6 }}>
              <strong>Time limit:</strong>{" "}
              {typeof job?.timeLimitMinutes === "number"
                ? job.timeLimitMinutes
                : 15 + (job?.extraQuestions?.length || 0) * 2}{" "}
              minutes
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              <strong>Integrity rules:</strong> Camera required, avoid tab
              switches, multiple switches may flag your attempt.
            </div>
            {(job?.extraQuestions || []).length > 0 && (
              <div className="small" style={{ marginTop: 8 }}>
                <strong>Additional questions:</strong>
                <ul className="small" style={{ marginTop: 4, paddingLeft: 18 }}>
                  {(job.extraQuestions || []).map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="small muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  if (e.target.checked) setAgreeError(null);
                }}
              />
              I agree to the integrity rules above.
            </label>
            {agreeError && <div className="small" style={{ color: "#ef4444", marginTop: 6 }}>{agreeError}</div>}
            <div className="mt-3">
              <button
                className="btn"
                onClick={() => {
                  if (!agree) {
                    setAgreeError("Please agree to the integrity rules to start.");
                    return;
                  }
                  setAgreeError(null);
                  setCountdown(3);
                }}
                disabled={countdown !== null}
              >
                {countdown !== null ? `Starting in ${countdown}...` : "Start Test"}
              </button>
            </div>
          </div>
        </div>
      )}
      {job && (
        <div className="card small muted">
          <div>{job.description}</div>
          <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
            {(job.skills||[]).map((s:string,ix:number)=>(<div key={ix} style={{padding:'6px 8px', background:'rgba(37,99,235,0.06)', borderRadius:8, color:'var(--muted)', fontSize:12}}>{s}</div>))}
            {typeof job.minExp === 'number' && (<div style={{padding:'6px 8px', background:'rgba(14,165,164,0.06)', borderRadius:8, color:'var(--muted)', fontSize:12}}>Min {job.minExp} yrs</div>)}
          </div>
        </div>
      )}
      <div className="test-layout">
        <div className="test-sidebar">
          {started && (
            <div className="card">
              <Proctor
                sessionId={sessionId}
                onMultiFace={(cnt) => {
                  if (cnt > 1) {
                    setMultiFaceDetected(true);
                    setIntegrityFail(
                      "Multiple faces detected. This attempt will be marked as failed.",
                    );
                  }
                }}
                onPermissionPrompt={(active) => {
                  permissionPromptRef.current = active;
                  suppressSwitchUntilRef.current = Date.now() + 5000;
                }}
              />
            </div>
          )}
          <div className="card mt-3">
            <div className="font-medium">Test status</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Time left:{" "}
              {Math.floor(timeLeft / 60).toString().padStart(2, "0")}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Tab switches: <strong>{tabSwitches}</strong>
            </div>
            {integrityFail && (
              <div className="small" style={{ color: "#ef4444", marginTop: 8 }}>
                {integrityFail}
              </div>
            )}
          </div>
          <div className="card mt-3">
            <div className="font-medium">Resume check</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Upload resume to validate skills and experience.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onClick={() => {
                fileDialogOpenRef.current = true;
                suppressSwitchUntilRef.current = Date.now() + 5000;
                window.setTimeout(() => {
                  fileDialogOpenRef.current = false;
                }, 5000);
              }}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setResumeFile(f);
                if (f) uploadResumeAndCheck(f);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              style={{ marginTop: 10 }}
            />
            <div className="mt-2 flex gap-2">
              <button className="btn" onClick={uploadResumeAndCheck} type="button">
                {uploading ? "Checking..." : "Upload & Check"}
              </button>
            </div>
            {resumeCheck && (
              <div className="muted small" style={{ marginTop: 8 }}>
                {resumeCheck.ok
                  ? `${resumeCheck.source === "profile" ? "Auto-checked from profile. " : ""}Skills matched: ${resumeCheck.skillsMatched}, Exp: ${resumeCheck.detectedExp}`
                  : "Check failed"}
              </div>
            )}
          </div>
        </div>
        <div className="card test-card">

          {aiQuestions.length > 0 && (
            <div className="question-card">
              <div className="font-medium">AI-tailored questions</div>
              <div className="small muted" style={{ marginTop: 6 }}>
                Generated from your resume and the job requirements.
              </div>
            </div>
          )}
          {aiLoading && (
            <div className="question-card">
              <div className="font-medium">Generating AI questions…</div>
              <div className="small muted" style={{ marginTop: 6 }}>
                Please wait a moment after uploading your resume.
              </div>
            </div>
          )}
          {aiError && (
            <div className="question-card">
              <div className="font-medium">AI questions unavailable</div>
              <div className="small muted" style={{ marginTop: 6 }}>
                {aiError}
              </div>
              <button
                className="btn btn-ghost mt-2"
                onClick={regenerateAiQuestions}
              >
                Try again
              </button>
            </div>
          )}
          {aiQuestions.map((q, idx) => (
            <div key={`ai-${q.id || idx}`} className="question-card">
              <div className="font-medium">{q.prompt}</div>
              {q.type === "short" && (
                <input
                  className="form-input mt-2"
                  value={answers[`ai-${idx}`] || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [`ai-${idx}`]: e.target.value }))
                  }
                />
              )}
              {q.type === "text" && (
                <textarea
                  className="form-input mt-2"
                  rows={4}
                  value={answers[`ai-${idx}`] || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [`ai-${idx}`]: e.target.value }))
                  }
                />
              )}
              {q.type === "code" && (
                <textarea
                  className="form-input mt-2"
                  rows={6}
                  value={answers[`ai-${idx}`] || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [`ai-${idx}`]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          {aiQuestions.length === 0 && !aiLoading && (
            <div className="question-card">
              <div className="font-medium">Upload your resume to start</div>
              <div className="small muted" style={{ marginTop: 6 }}>
                AI questions appear after your resume is processed. Recruiter
                questions will still be shown below.
              </div>
            </div>
          )}
          {(job?.extraQuestions || []).map((q: string, i: number) => (
            <div key={`extra-${i}`} className="question-card">
              <div className="font-medium">{q}</div>
              <textarea
                className="form-input mt-2"
                rows={4}
                value={answers[`extra-${i}`] || ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [`extra-${i}`]: e.target.value }))
                }
              />
            </div>
          ))}
          <div className="mt-4 flex gap-2 items-center">
            <button
              className="btn"
              onClick={submit}
              disabled={
                submitting ||
                (resumeCheck &&
                  resumeCheck.ok === true &&
                  (!resumeCheck.skillsOk || !resumeCheck.expOk))
              }
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            {tabWarning && (
              <div className="muted small">{tabWarning}</div>
            )}
            {integrityFail && (
              <div className="small" style={{ color: "#ef4444" }}>
                {integrityFail}
              </div>
            )}
            {result && (
              <div className="muted small">
                You scored <strong>{result.score}</strong>.{" "}
                {result.passed ? "You passed this test." : "You did not pass."}{" "}
                Your attempt will be available to recruiters along with
                integrity and question-wise analysis.
                {" "}
                <span>
                  Integrity:{" "}
                  <strong>{tabSwitches > 1 ? "Flagged" : "Clean"}</strong>
                </span>
                {typeof result.aiScore === "number" && (
                  <span> • AI score: <strong>{result.aiScore}</strong></span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

