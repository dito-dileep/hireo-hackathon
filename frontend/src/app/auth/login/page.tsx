"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const router = useRouter();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const [captchaReady, setCaptchaReady] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let retries = 0;
    let retryTimer: number | null = null;
    function renderWidget() {
      if (!captchaRef.current) return;
      if (!(window as any).grecaptcha || typeof (window as any).grecaptcha.render !== "function") return;
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = (window as any).grecaptcha.render(
        captchaRef.current,
        {
          sitekey: siteKey,
          callback: (token: string) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(""),
        },
      );
      setCaptchaReady(true);
    }
    function scheduleRetry() {
      if (retryTimer) return;
      retryTimer = window.setInterval(() => {
        retries += 1;
        renderWidget();
        if (widgetIdRef.current !== null || retries > 10) {
          if (retryTimer) window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 300);
    }
    if ((window as any).grecaptcha) {
      renderWidget();
      scheduleRetry();
      return () => {
        if (retryTimer) window.clearInterval(retryTimer);
      };
    }
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      renderWidget();
      scheduleRetry();
    };
    s.onerror = () => setCaptchaReady(false);
    document.head.appendChild(s);
    return () => {
      if (retryTimer) window.clearInterval(retryTimer);
    };
  }, [siteKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!siteKey) {
      setError("reCAPTCHA not configured.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the reCAPTCHA.");
      return;
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, captchaToken }),
    });
    const j = await res.json();
    if (j.ok && j.token) {
      // clear any previous session and store fresh token
      localStorage.removeItem("token");
      localStorage.setItem("token", j.token);
      router.push("/");
    } else setError(j.error || "Login failed");
  }

  return (
    <div className="card max-w-md">
      <h2 className="text-xl font-semibold mb-3">Sign in</h2>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="form-input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {siteKey ? (
          <div ref={captchaRef} />
        ) : (
          <div className="small" style={{ color: "#ef4444" }}>
            reCAPTCHA site key missing. Add
            {" "}
            <code>NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> and restart.
          </div>
        )}
        {siteKey && !captchaReady && (
          <div className="small muted">Loading reCAPTCHA…</div>
        )}
        <div className="flex gap-2 items-center">
          <button className="btn">Sign in</button>
          <div className="muted">{error}</div>
        </div>
      </form>
    </div>
  );
}
