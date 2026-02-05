import { join } from "path";
import fs from "fs";

type Job = {
  id: string;
  title: string;
  description: string;
  company?: string;
  skills?: string[];
  minExp?: number;
  vacancyTotal?: number;
  vacancyRemaining?: number;
  extraQuestions?: string[];
  extraExpectedAnswers?: string[];
  timeLimitMinutes?: number;
  created_at?: number;
};
type Submission = {
  id: number;
  jobId: string;
  sessionId: string;
  answers: Record<string, unknown>;
  score: number | null;
  passed: boolean | null;
  technicalScore: number | null;
  reasoningScore: number | null;
  explanation: string | null;
  candidateUsername: string | null;
  tabSwitches: number;
  proctorFlags?: { multiFaceDetected?: boolean } | null;
  extraAi?: {
    overallScore: number;
    perQuestion: { score: number; rationale: string }[];
    summary: string;
  } | null;
  aiAll?: {
    overallScore: number;
    technicalScore?: number | null;
    reasoningScore?: number | null;
    perQuestion: { id: string; score: number; correct: boolean; rationale: string }[];
    summary: string;
  } | null;
  created_at: number;
};
type ProctorLog = { id: number; sessionId: string; type: string; payload: unknown | null; image_base64?: string | null; created_at: number };
type Resume = { id: number; jobId: string | null; sessionId: string; filename: string; content_base64: string; text_excerpt?: string | null; created_at: number };
type User = { id: string; username: string; passwordHash: string; role: string; created_at?: number };
type DB = { jobs: Job[]; submissions: Submission[]; proctor_logs: ProctorLog[]; resumes?: Resume[]; users: User[] };

const dataDir = join(process.cwd(), "data");
const dbFile = join(dataDir, "db.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function readDB(): DB {
  try {
    if (!fs.existsSync(dbFile)) {
      const init: DB = { jobs: [], submissions: [], proctor_logs: [], users: [] };
      fs.writeFileSync(dbFile, JSON.stringify(init, null, 2), "utf8");
      return init;
    }
    const raw = fs.readFileSync(dbFile, "utf8");
    return JSON.parse(raw) as DB;
  } catch (err) {
    console.error("readDB error", err);
    return { jobs: [], submissions: [], proctor_logs: [], users: [] } as DB;
  }
}

function writeDB(data: DB) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf8");
}

export function addJob(job: {
  id: string;
  title: string;
  description: string;
  company?: string;
  skills?: string[];
  minExp?: number;
  vacancyTotal?: number;
  vacancyRemaining?: number;
  extraQuestions?: string[];
  extraExpectedAnswers?: string[];
  timeLimitMinutes?: number;
}) {
  const db = readDB();
  db.jobs = db.jobs || [];
  db.jobs.unshift({ ...job, created_at: Date.now() });
  writeDB(db);
}

export function getJobs(): Job[] {
  const db = readDB();
  db.jobs = db.jobs || [];
  return db.jobs;
}

export function updateJob(jobId: string, updates: Partial<Job>) {
  const db = readDB();
  db.jobs = db.jobs || [];
  const idx = db.jobs.findIndex((j: Job) => j.id === jobId);
  if (idx === -1) return null;
  db.jobs[idx] = { ...db.jobs[idx], ...updates };
  writeDB(db);
  return db.jobs[idx];
}

export function deleteJob(jobId: string) {
  const db = readDB();
  db.jobs = db.jobs || [];
  const before = db.jobs.length;
  db.jobs = db.jobs.filter((j: Job) => j.id !== jobId);
  writeDB(db);
  return before !== db.jobs.length;
}

export function addSubmission(sub: {
  jobId: string;
  sessionId: string;
  answers: Record<string, unknown>;
  score?: number;
  passed?: boolean;
  technicalScore?: number | null;
  reasoningScore?: number | null;
  explanation?: string;
  candidateUsername?: string;
  tabSwitches?: number;
  proctorFlags?: { multiFaceDetected?: boolean } | null;
  extraAi?: { overallScore: number; perQuestion: { score: number; rationale: string }[]; summary: string } | null;
  aiAll?: {
    overallScore: number;
    technicalScore?: number | null;
    reasoningScore?: number | null;
    perQuestion: { id: string; score: number; correct: boolean; rationale: string }[];
    summary: string;
  } | null;
}) {
  const db = readDB();
  db.submissions = db.submissions || [];
  db.submissions.push({
    id: (db.submissions.length || 0) + 1,
    jobId: sub.jobId,
    sessionId: sub.sessionId,
    answers: sub.answers || {},
    score: sub.score ?? null,
    passed: sub.passed ?? null,
    technicalScore: sub.technicalScore ?? null,
    reasoningScore: sub.reasoningScore ?? null,
    explanation: sub.explanation ?? null,
    candidateUsername: sub.candidateUsername || null,
    tabSwitches: typeof sub.tabSwitches === "number" ? sub.tabSwitches : 0,
    proctorFlags: sub.proctorFlags ?? null,
    extraAi: sub.extraAi ?? null,
    aiAll: sub.aiAll ?? null,
    created_at: Date.now(),
  });
  writeDB(db);
}

export function decrementVacancyOnPass(jobId: string) {
  const db = readDB();
  db.jobs = db.jobs || [];
  const job = db.jobs.find((j: Job) => j.id === jobId);
  if (!job) return { updated: false, deleted: false, remaining: null };
  if (typeof job.vacancyRemaining !== "number") {
    return { updated: false, deleted: false, remaining: null };
  }
  const next = Math.max(0, job.vacancyRemaining - 1);
  job.vacancyRemaining = next;
  let deleted = false;
  if (next <= 0) {
    db.jobs = db.jobs.filter((j: Job) => j.id !== jobId);
    deleted = true;
  }
  writeDB(db);
  return { updated: true, deleted, remaining: next };
}

export function getSubmissionsForSession(sessionId: string): Submission[] {
  const db = readDB();
  db.submissions = db.submissions || [];
  return db.submissions.filter((s: Submission) => s.sessionId === sessionId).sort((a: Submission, b: Submission) => a.created_at - b.created_at);
}

export function getAllSubmissions(): Submission[] {
  const db = readDB();
  db.submissions = db.submissions || [];
  return db.submissions.slice().sort((a: Submission, b: Submission) => a.created_at - b.created_at);
}

export function addProctorLog(log: { sessionId: string; type: string; payload?: unknown; image_base64?: string }) {
  const db = readDB();
  db.proctor_logs = db.proctor_logs || [];
  db.proctor_logs.push({ id: (db.proctor_logs.length || 0) + 1, sessionId: log.sessionId, type: log.type, payload: log.payload || null, image_base64: log.image_base64 || null, created_at: Date.now() });
  writeDB(db);
}

export function getProctorLogsForSession(sessionId: string): ProctorLog[] {
  const db = readDB();
  db.proctor_logs = db.proctor_logs || [];
  return db.proctor_logs.filter((l: ProctorLog) => l.sessionId === sessionId).sort((a: ProctorLog, b: ProctorLog) => a.created_at - b.created_at);
}

// --- resume helpers ---
export function addResume(res: { jobId?: string; sessionId: string; filename: string; content_base64: string; text_excerpt?: string }) {
  const db = readDB();
  db.resumes = db.resumes || [];
  db.resumes.push({ id: (db.resumes.length || 0) + 1, jobId: res.jobId || null, sessionId: res.sessionId, filename: res.filename, content_base64: res.content_base64, text_excerpt: res.text_excerpt || null, created_at: Date.now() });
  writeDB(db);
}

export function getResumesForSession(sessionId: string): Resume[] {
  const db = readDB();
  db.resumes = db.resumes || [];
  return db.resumes.filter((r: Resume) => r.sessionId === sessionId).sort((a: Resume, b: Resume) => a.created_at - b.created_at);
}

export function getDistinctSessions() {
  const db = readDB();
  db.proctor_logs = db.proctor_logs || [];
  const set = new Set<string>();
  for (const l of db.proctor_logs.slice().reverse()) set.add(l.sessionId);
  return Array.from(set);
}

export default { readDB, writeDB };

// --- users helper functions (simple JSON-based user store) ---
export function addUser(u: { id: string; username: string; passwordHash: string; role: string }) {
  const db = readDB();
  db.users = db.users || [];
  db.users.push({ ...u, created_at: Date.now() });
  writeDB(db);
}

export function getUserByUsername(username: string): User | null {
  const db = readDB();
  db.users = db.users || [];
  return db.users.find((x: User) => x.username === username) || null;
}

export function getUserById(id: string): User | null {
  const db = readDB();
  db.users = db.users || [];
  return db.users.find((x: User) => x.id === id) || null;
}


