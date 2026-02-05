import Link from "next/link";

export default function Home() {
  return (
    <div className="hero card">
      <div style={{ flex: 1 }}>
        <div className="title">HIREO</div>
        <div className="lead" style={{ marginTop: 8 }}>
          Modern, minimal hiring platform — remote proctored tests, resume
          checks, and recruiter dashboards to spot suspicious sessions.
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <Link href="/recruiter" className="btn">
            Post Job
          </Link>
          <Link href="/candidate" className="btn">
            Find Jobs
          </Link>
          <Link href="/reports" className="btn">
            View Reports
          </Link>
        </div>
        <div className="small muted" style={{ marginTop: 12 }}>
          Tips: allow camera access for proctoring, upload a resume to validate
          job requirements before submitting tests.
        </div>
      </div>
      <div style={{ width: 320 }}>
        <div className="card center">
          <svg
            width="120"
            height="120"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="24" height="24" rx="6" fill="url(#g)" />
            <text
              x="12"
              y="15"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#ffffff"
            >
              H
            </text>
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0" stopColor="#0ea5a4" />
                <stop offset="1" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ marginTop: 10 }} className="small muted">
            Secure proctoring • Quick scoring • Recruiter reports
          </div>
        </div>
      </div>
    </div>
  );
}
