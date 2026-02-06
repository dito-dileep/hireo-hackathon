"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  title: string;
  description: string;
  skills?: string[];
  minExp?: number;
  company?: string;
  created_at?: number;
  vacancyTotal?: number;
  vacancyRemaining?: number;
  extraQuestions?: string[];
  extraExpectedAnswers?: string[];
  timeLimitMinutes?: number;
};

export default function RecruiterPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [skills, setSkills] = useState("");
  const [minExp, setMinExp] = useState(0);
  const [company, setCompany] = useState("");
  const [vacancy, setVacancy] = useState(1);
  const [extraQuestionsText, setExtraQuestionsText] = useState("");
  const [extraExpectedText, setExtraExpectedText] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editMinExp, setEditMinExp] = useState(0);
  const [editVacancy, setEditVacancy] = useState(1);
  const [editExtraQuestionsText, setEditExtraQuestionsText] = useState("");
  const [editExtraExpectedText, setEditExtraExpectedText] = useState("");
  const [editTimeLimitMinutes, setEditTimeLimitMinutes] = useState(15);
  const [editMessage, setEditMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [editFormError, setEditFormError] = useState("");

  const MAX_Q_LEN = 200;
  function parseExtraQuestions(text: string) {
    const list = text
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    const tooLong = list.find((q) => q.length > MAX_Q_LEN);
    return { list, tooLong };
  }

  function parseExpected(text: string) {
    const list = text
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    const tooLong = list.find((q) => q.length > MAX_Q_LEN);
    return { list, tooLong };
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

  async function postJob(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const parsed = parseExtraQuestions(extraQuestionsText);
    const parsedExpected = parseExpected(extraExpectedText);
    if (parsed.tooLong) {
      setFormError(`Each extra question must be ${MAX_Q_LEN} characters or fewer.`);
      return;
    }
    if (parsedExpected.tooLong) {
      setFormError(`Each expected answer must be ${MAX_Q_LEN} characters or fewer.`);
      return;
    }
    if (parsedExpected.list.length > 0 && parsed.list.length === 0) {
      setFormError("Add extra questions before providing expected answers.");
      return;
    }
    if (
      parsedExpected.list.length > 0 &&
      parsedExpected.list.length !== parsed.list.length
    ) {
      setFormError("Expected answers count must match extra questions count.");
      return;
    }
    const minTime = 15 + parsed.list.length * 2;
    if (timeLimitMinutes < minTime) {
      setFormError(`Time limit must be at least ${minTime} minutes for ${parsed.list.length} extra question(s).`);
      return;
    }
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title,
        description: desc,
        company: company.trim() || undefined,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        minExp,
        vacancyTotal: vacancy,
        extraQuestions: parsed.list,
        extraExpectedAnswers: parsedExpected.list,
        timeLimitMinutes,
      }),
    });
    if (res.ok) {
      setMessage("Job posted");
      setTitle("");
      setDesc("");
      setSkills("");
      setMinExp(0);
      setVacancy(1);
      setCompany("");
      setExtraQuestionsText("");
      setExtraExpectedText("");
      setTimeLimitMinutes(15);
      fetchJobs();
    } else setMessage("Failed");
  }

  function startEdit(j: Job) {
    setEditJobId(j.id);
    setEditTitle(j.title || "");
    setEditDesc(j.description || "");
    setEditSkills((j.skills || []).join(", "));
    setEditMinExp(typeof j.minExp === "number" ? j.minExp : 0);
    const v =
      typeof j.vacancyTotal === "number"
        ? j.vacancyTotal
        : typeof j.vacancyRemaining === "number"
          ? j.vacancyRemaining
          : 1;
    setEditVacancy(v);
    setEditExtraQuestionsText((j.extraQuestions || []).join("\n"));
    setEditExtraExpectedText((j.extraExpectedAnswers || []).join("\n"));
    setEditTimeLimitMinutes(
      typeof j.timeLimitMinutes === "number" ? j.timeLimitMinutes : 15,
    );
    setEditMessage("");
    setEditFormError("");
  }

  async function saveEdit() {
    if (!editJobId) return;
    setEditFormError("");
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const parsed = parseExtraQuestions(editExtraQuestionsText);
    const parsedExpected = parseExpected(editExtraExpectedText);
    if (parsed.tooLong) {
      setEditFormError(`Each extra question must be ${MAX_Q_LEN} characters or fewer.`);
      return;
    }
    if (parsedExpected.tooLong) {
      setEditFormError(`Each expected answer must be ${MAX_Q_LEN} characters or fewer.`);
      return;
    }
    if (parsedExpected.list.length > 0 && parsed.list.length === 0) {
      setEditFormError("Add extra questions before providing expected answers.");
      return;
    }
    if (
      parsedExpected.list.length > 0 &&
      parsedExpected.list.length !== parsed.list.length
    ) {
      setEditFormError("Expected answers count must match extra questions count.");
      return;
    }
    const minTime = 15 + parsed.list.length * 2;
    if (editTimeLimitMinutes < minTime) {
      setEditFormError(`Time limit must be at least ${minTime} minutes for ${parsed.list.length} extra question(s).`);
      return;
    }
    const res = await fetch("/api/jobs", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jobId: editJobId,
        title: editTitle,
        description: editDesc,
        skills: editSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        minExp: editMinExp,
        vacancyTotal: editVacancy,
        extraQuestions: parsed.list,
        extraExpectedAnswers: parsedExpected.list,
        timeLimitMinutes: editTimeLimitMinutes,
      }),
    });
    if (res.ok) {
      setEditMessage("Updated");
      setEditJobId(null);
      fetchJobs();
    } else setEditMessage("Update failed");
  }

  async function deleteJobById(id: string) {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch("/api/jobs", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jobId: id }),
    });
    if (res.ok) {
      fetchJobs();
    }
  }

  async function fetchJobs() {
    try {
      const r = await fetch('/api/jobs');
      if (r.ok) {
        const j = await r.json();
        setJobs(j.jobs || []);
      }
    } catch (e) {
      console.error('fetchJobs error', e);
    }
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  if (authorized === false)
    return (
      <div className="card">
        Access denied. Please <a href="/auth/login">login</a> as a recruiter.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-semibold mb-2">Recruiter — Post a Job</h2>
        <form onSubmit={postJob} className="max-w-xl space-y-4">
          <input
            className="form-input"
            placeholder="Job title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="form-input"
            placeholder="Description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Required skills (comma separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={0}
              className="form-input w-28"
              value={minExp}
              onChange={(e) => setMinExp(Number(e.target.value))}
            />
            <div className="muted">Minimum years experience</div>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              className="form-input w-28"
              value={vacancy}
              onChange={(e) => setVacancy(Number(e.target.value))}
            />
            <div className="muted">Vacancies (seats)</div>
          </div>
          <textarea
            className="form-input"
            placeholder="Additional test questions (one per line)"
            value={extraQuestionsText}
            onChange={(e) => setExtraQuestionsText(e.target.value)}
          />
          <textarea
            className="form-input"
            placeholder="Expected answers (one per line, optional)"
            value={extraExpectedText}
            onChange={(e) => setExtraExpectedText(e.target.value)}
          />
          <div className="muted small">
            Optional. Each question max {MAX_Q_LEN} chars. Time limit must be at least 15 + 2 minutes per extra question.
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={5}
              className="form-input w-28"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            />
            <div className="muted">Time limit (minutes)</div>
          </div>
          {formError && <div className="small" style={{ color: "#ef4444" }}>{formError}</div>}
          <div className="flex gap-3 items-center">
            <button className="btn">Post</button>
            <div className="muted">{message}</div>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Your Posted Jobs</h3>
        <div className="grid">
          {jobs.map((j) => (
            <div key={j.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="font-medium">{j.title}</div>
                  <div className="muted small">{j.company}</div>
                </div>
                <div className="muted small">
                  {j.created_at
                    ? new Date(j.created_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>{j.description}</div>
              {typeof j.vacancyRemaining === "number" && (
                <div className="muted small" style={{ marginTop: 8 }}>
                  Vacancies:{" "}
                  <strong>
                    {j.vacancyRemaining}
                    {typeof j.vacancyTotal === "number" ? ` / ${j.vacancyTotal}` : ""}
                  </strong>
                </div>
              )}
              {(j.extraQuestions || []).length > 0 && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Extra questions:{" "}
                  <strong>
                    {(j.extraQuestions || []).length}
                  </strong>
                </div>
              )}
              {typeof j.timeLimitMinutes === "number" && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Time limit: <strong>{j.timeLimitMinutes} min</strong>
                </div>
              )}
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(j.skills || []).map((s: string, ix: number) => (
                  <div key={ix} style={{ padding: "6px 8px", background: "rgba(37,99,235,0.06)", borderRadius: 8, color: "var(--muted)", fontSize: 12 }}>{s}</div>
                ))}
                {typeof j.minExp === "number" && (
                  <div style={{ padding: "6px 8px", background: "rgba(14,165,164,0.06)", borderRadius: 8, color: "var(--muted)", fontSize: 12 }}>Min {j.minExp} yrs</div>
                )}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="btn" type="button" onClick={() => startEdit(j)}>
                  Edit
                </button>
                <button className="btn" type="button" onClick={() => deleteJobById(j.id)}>
                  Remove
                </button>
              </div>
              {editJobId === j.id && (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="font-medium mb-2">Edit job</div>
                  <div className="space-y-3">
                    <input
                      className="form-input"
                      placeholder="Job title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                    <textarea
                      className="form-input"
                      placeholder="Description"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Required skills (comma separated)"
                      value={editSkills}
                      onChange={(e) => setEditSkills(e.target.value)}
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={0}
                        className="form-input w-28"
                        value={editMinExp}
                        onChange={(e) => setEditMinExp(Number(e.target.value))}
                      />
                      <div className="muted">Minimum years experience</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={1}
                        className="form-input w-28"
                        value={editVacancy}
                        onChange={(e) => setEditVacancy(Number(e.target.value))}
                      />
                      <div className="muted">Vacancies (seats)</div>
                    </div>
                    <textarea
                      className="form-input"
                      placeholder="Additional test questions (one per line)"
                      value={editExtraQuestionsText}
                      onChange={(e) => setEditExtraQuestionsText(e.target.value)}
                    />
                    <textarea
                      className="form-input"
                      placeholder="Expected answers (one per line, optional)"
                      value={editExtraExpectedText}
                      onChange={(e) => setEditExtraExpectedText(e.target.value)}
                    />
                    <div className="muted small">
                      Optional. Each question max {MAX_Q_LEN} chars. Time limit must be at least 15 + 2 minutes per extra question.
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={5}
                        className="form-input w-28"
                        value={editTimeLimitMinutes}
                        onChange={(e) => setEditTimeLimitMinutes(Number(e.target.value))}
                      />
                      <div className="muted">Time limit (minutes)</div>
                    </div>
                    {editFormError && <div className="small" style={{ color: "#ef4444" }}>{editFormError}</div>}
                    <div className="flex gap-3 items-center">
                      <button className="btn" type="button" onClick={saveEdit}>
                        Save
                      </button>
                      <button className="btn" type="button" onClick={() => setEditJobId(null)}>
                        Cancel
                      </button>
                      <div className="muted">{editMessage}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {jobs.length === 0 && <div className="muted">No jobs posted yet</div>}
        </div>
      </div>
    </div>
  );
}
