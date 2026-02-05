# HIREO_PROJECT Frontend (Developer Notes)

Quick start (dev):

1. Open a terminal in `HIREO_PROJECT/frontend`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

Important files added by scaffold:

- `src/app/components/Proctor.tsx` — proctoring UI that captures webcam snapshots and visibility events and posts them to `/api/proctor`.
- `src/app/recruiter/page.tsx` — recruiter dashboard to post jobs.
- `src/app/candidate/page.tsx` — candidate dashboard listing jobs.
- `src/app/job/[id]/page.tsx` — test-taking page with proctor component.
- `src/app/api/jobs/route.ts` — in-memory jobs and submission API (GET/POST/PUT).
- `src/app/api/proctor/route.ts` — endpoint that accepts images (FormData) and visibility events.
- `src/app/api/auth/route.ts` — simple auth stub returning a mock token.

Notes & next steps:
- This is a demo scaffold to give a working UI and proctoring flow. For production you'll want to add persistent storage, secure authentication, image storage, and integrate a real AI service for cheat analysis.
- To test proctoring locally ensure you allow camera permission in the browser.
- Added lightweight JSON persistence. Database file will be created at `HIREO_PROJECT/frontend/data/db.json`.
 - New endpoints:
	 - `GET /api/jobs` — list jobs
	 - `POST /api/jobs` — create job
	 - `PUT /api/jobs` — submit test answers
	 - `POST /api/proctor` — receive snapshots (FormData) and visibility events (JSON via sendBeacon)
	 - `GET /api/proctor?sessionId=...` — fetch proctor logs for a session
	 - `GET /api/reports/sessions` — list recorded sessions
	 - `POST /api/ai/analyze` — simple AI heuristic analysis for a session

Run steps (after these changes):

```bash
cd "HIREO_PROJECT/frontend"
npm install
npm run dev
```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
