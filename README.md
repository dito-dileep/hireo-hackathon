# HIREO — AI-Assisted Proctored Hiring Platform

HIREO is a hackathon-ready hiring platform that combines proctored assessments, AI-assisted scoring, and recruiter-friendly reporting. It helps recruiters post roles, run structured tests, verify integrity signals, and review candidate performance with minimal friction.

## Team Credits

- Dito Dileep — RA2411026010050
- Adithya R Nath — RA2411026010003
- Shashwat — RA2511026010402

## Problem We Solve

Recruiters often struggle to validate candidate performance in remote assessments. HIREO addresses this with:

- Proctored test sessions (camera snapshots + tab focus signals)
- Integrity flags (tab switching, multi-face detection)
- AI-assisted grading that recognizes correct logic even if phrased differently
- Recruiter dashboards with downloadable reports and timelines

## Key Features

- Recruiter job posting with skills, minimum experience, vacancies, and custom questions
- Candidate tests with timer, resume matching, and proctoring
- AI grading across all questions (semantic matching)
- AI resume matching (skills extraction and comparison)
- Integrity monitoring with proctor timeline and flags
- PDF reports for recruiters
- reCAPTCHA on auth screens

## Project Structure

- `frontend` — Next.js app (UI + API routes)
- `backend` — FastAPI service (scoring/explanations)

## Quick Start (Local Development)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs at http://localhost:8000

## Environment Variables

Frontend uses `.env.local` (do not commit real keys):

```env
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=YOUR_RECAPTCHA_SITE_KEY
RECAPTCHA_SECRET_KEY=YOUR_RECAPTCHA_SECRET_KEY
AUTH_SECRET=YOUR_RANDOM_STRING
```

## How It Works (High Level)

1. Recruiter posts a job with required skills, vacancies, and optional extra questions.
2. Candidate selects a job, uploads a resume, and completes the proctored test.
3. Proctoring logs events and captures snapshots; integrity flags are generated.
4. AI grading evaluates answers semantically and produces scores and rationale.
5. Recruiter reviews results, integrity timeline, and downloads PDF reports.

## API Notes

- Frontend uses Next.js API routes for most data operations.
- FastAPI backend handles score/explanation endpoints.
- If deployed, update frontend to call the backend’s public URL.

## Security & Privacy Notes

- Do not commit real API keys.
- Use environment variables for secrets in Vercel/Render.
- reCAPTCHA helps prevent automated abuse.

## Deployment

### Frontend (Vercel)

- Import GitHub repo
- Set Root Directory to `frontend`
- Add env vars from above in Vercel → Project → Settings → Environment Variables

### Backend (Render/Railway)

- Deploy `backend` folder as a Web Service
- Build: `pip install -r requirements.txt`
- Start: `python main.py`

Update frontend API base URL if you deploy the backend.

## Credits & Acknowledgements

Built for SRM Innovation Hackathon (Edition 1).
