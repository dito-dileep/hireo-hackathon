# HIREO — AI-Assisted Proctored Hiring Platform

AI-assisted hiring platform with recruiter dashboards, candidate tests, integrity monitoring, and reports.

## Team Credits

- Dito Dileep — RA2411026010050
- Adithya R Nath — RA2411026010003
- Shashwat — RA2511026010402

## Project Structure

- `frontend` — Next.js app (UI + API routes)
- `backend` — FastAPI service (scoring/explanations)

## Quick Start (Local)

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
