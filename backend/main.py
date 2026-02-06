from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel


app = FastAPI(title="HIREO Backend", version="0.2.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allow_origins = [o.strip() for o in cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Simple profile storage (JSON file for demo) ----
DATA_DIR = Path(__file__).resolve().parent
PROFILES_FILE = DATA_DIR / "profiles.json"


def read_profiles():
    if not PROFILES_FILE.exists():
        PROFILES_FILE.write_text("{}", encoding="utf8")
        return {}
    try:
        return json.loads(PROFILES_FILE.read_text(encoding="utf8"))
    except Exception:
        return {}


def write_profiles(data):
    PROFILES_FILE.write_text(json.dumps(data, indent=2), encoding="utf8")


@app.get("/health")
async def health():
    return {"ok": True, "service": "hireo-backend", "status": "healthy"}


class ExplainRequest(BaseModel):
    score: int
    technicalScore: int | None = None
    reasoningScore: int | None = None
    tabSwitches: int | None = None


@app.post("/ai/explain")
async def explain(req: ExplainRequest):
    """
    Deterministic explanation endpoint.
    Mirrors the scoring explanation logic but does not re-compute scores.
    """
    score = req.score
    tech = req.technicalScore
    reasoning = req.reasoningScore
    tab_switches = req.tabSwitches or 0

    # Base on score
    if score >= 80:
        base = (
            "Candidate demonstrated strong overall performance across logic and coding tasks."
        )
    elif score >= 60:
        base = (
            "Candidate met the minimum bar with some gaps; suitable for further interview rounds."
        )
    else:
        base = (
            "Candidate struggled with key assessment areas. Consider only for junior roles or keep as future talent."
        )

    # Compare technical vs reasoning
    if tech is not None and reasoning is not None:
        if tech > reasoning + 15:
            base += " Technical skills appear stronger than reasoning and problem framing."
        elif reasoning > tech + 15:
            base += " Reasoning and communication appear stronger than pure coding implementation."

    # Integrity signal
    if tab_switches > 0:
        base += f" Approximately {tab_switches} tab or window switches were detected during the assessment."
        if tab_switches == 1:
            base += " Single switch is acceptable but should be noted for critical roles."
        elif tab_switches > 1:
            base += " Multiple switches indicate a higher cheating risk; treat this attempt with caution."

    return {"ok": True, "explanation": base}


class ScoreRequest(BaseModel):
    answers: dict
    tabSwitches: int | None = None


@app.post("/score")
async def score_candidate(req: ScoreRequest):
    """
    Implements the dual-track scoring rubric in Python.
    This lets the frontend call a single endpoint to grade a submission.
    """
    raw_answers = req.answers or {}
    # Normalize JSON keys (often strings) into ints for scoring.
    answers = {}
    for k, v in raw_answers.items():
        try:
            ik = int(k)
        except (TypeError, ValueError):
            continue
        answers[ik] = v
    tab_switches = req.tabSwitches or 0

    total = 0
    earned = 0
    technical_total = 0
    technical_earned = 0
    reasoning_total = 0
    reasoning_earned = 0

    # --- MCQ questions 1 & 2: each 10 points, reasoning bucket ---
    mcq_key = {1: 1, 2: 0}
    for qid, correct in mcq_key.items():
        max_pts = 10
        total += max_pts
        reasoning_total += max_pts
        if int(answers.get(qid, -1)) == correct:
            earned += max_pts
            reasoning_earned += max_pts

    # --- Aptitude numeric (id 3): up to 30 points, reasoning-heavy ---
    if 3 in answers:
        max_pts = 30
        total += max_pts
        reasoning_total += max_pts
        raw = str(answers[3]).strip()
        digits = "".join(ch for ch in raw if ch.isdigit() or ch == ".")
        pts = 0
        try:
            val = float(digits)
            diff = abs(val - 45.0)
            if diff == 0:
                pts = max_pts
            elif diff <= 3:
                pts = round(max_pts * 0.7)
            elif diff <= 8:
                pts = round(max_pts * 0.4)
        except ValueError:
            pts = 0
        earned += pts
        reasoning_earned += pts

    # --- Coding question (id 4): 50 points, technical bucket ---
    if 4 in answers:
        max_pts = 50
        total += max_pts
        technical_total += max_pts
        code = str(answers[4]).lower()
        pts = 0
        mentions_array = (
            "[" in code or "array" in code or "list" in code or "nums" in code
        )
        has_loop = (
            "for" in code or "while" in code or "reduce" in code
        )
        uses_acc = (
            "sum" in code or "total" in code or "+=" in code
        )
        returns_result = (
            "return" in code or "=>" in code or "func" in code
        )

        if mentions_array:
            pts += 10
        if has_loop:
            pts += 15
        if uses_acc:
            pts += 15
        if returns_result:
            pts += 10

        pts = min(max_pts, pts)
        earned += pts
        technical_earned += pts

    # --- Communication question (id 5): up to 10 reasoning points ---
    if 5 in answers:
        max_pts = 10
        total += max_pts
        reasoning_total += max_pts
        text = str(answers[5]).lower()
        pts = 0
        if len(text) > 40:
            pts += 4
        if any(k in text for k in ("logs", "monitoring", "metrics")):
            pts += 3
        if any(k in text for k in ("rollback", "feature flag", "safe")):
            pts += 3
        pts = min(max_pts, pts)
        earned += pts
        reasoning_earned += pts

    overall_score = int(round((earned / total) * 100)) if total > 0 else 0
    technical_score = (
        int(round((technical_earned / technical_total) * 100))
        if technical_total > 0
        else None
    )
    reasoning_score = (
        int(round((reasoning_earned / reasoning_total) * 100))
        if reasoning_total > 0
        else None
    )

    base_explanation = ""
    if overall_score >= 80:
        base_explanation = (
            "Candidate demonstrated strong overall performance across logic and coding tasks."
        )
    elif overall_score >= 60:
        base_explanation = (
            "Candidate met the minimum bar with some gaps; suitable for further interview rounds."
        )
    else:
        base_explanation = (
            "Candidate struggled with key assessment areas. Consider for junior or alternative roles only if other signals are strong."
        )

    if technical_score is not None and reasoning_score is not None:
        if technical_score > reasoning_score + 15:
            base_explanation += (
                " Technical skills look stronger than reasoning and problem framing."
            )
        elif reasoning_score > technical_score + 15:
            base_explanation += (
                " Reasoning and basic problem solving are stronger than pure coding implementation."
            )

    if tab_switches > 0:
        base_explanation += (
            f" Proctoring noted approximately {tab_switches} tab or window switches during the test."
        )
        if tab_switches == 1:
            base_explanation += (
                " Candidate switched away from the test once; acceptable but keep this in mind for critical roles."
            )
        elif tab_switches > 1:
            base_explanation += (
                " Excessive tab switching suggests the candidate may have been referencing external material. This attempt is marked as failed for integrity."
            )

    proctor_hard_fail = tab_switches > 1
    passed = overall_score >= 60 and not proctor_hard_fail

    return {
        "ok": True,
        "score": overall_score,
        "technicalScore": technical_score,
        "reasoningScore": reasoning_score,
        "passed": passed,
        "tabSwitches": tab_switches,
        "explanation": base_explanation,
    }


class ProfilePayload(BaseModel):
    username: str
    fullName: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[int] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    updatedAt: Optional[int] = None
    resumeFilename: Optional[str] = None
    resumeBase64: Optional[str] = None
    resumeText: Optional[str] = None


@app.get("/profiles/{username}")
async def get_profile(username: str):
    data = read_profiles()
    profile = data.get(username)
    return {"ok": True, "profile": profile}


@app.put("/profiles/{username}")
async def put_profile(username: str, payload: ProfilePayload):
    data = read_profiles()
    profile = data.get(username, {})
    profile.update(
        {
            "username": username,
            "fullName": payload.fullName,
            "skills": payload.skills or [],
            "experience": payload.experience,
            "bio": payload.bio,
            "location": payload.location,
            "updatedAt": payload.updatedAt or int(__import__("time").time() * 1000),
        }
    )
    data[username] = profile
    write_profiles(data)
    return {"ok": True, "profile": profile}


@app.post("/profiles/{username}/resume")
async def put_resume(username: str, payload: ProfilePayload):
    data = read_profiles()
    profile = data.get(username, {})
    profile.update(
        {
            "username": username,
            "resumeFilename": payload.resumeFilename,
            "resumeBase64": payload.resumeBase64,
            "resumeText": payload.resumeText,
            "updatedAt": payload.updatedAt or int(__import__("time").time() * 1000),
        }
    )
    data[username] = profile
    write_profiles(data)
    return {"ok": True, "profile": profile}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

