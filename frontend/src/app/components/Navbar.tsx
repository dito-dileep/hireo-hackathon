"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // fetch user info using token from localStorage
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setUser(j.user);
      })
      .catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="navbar site-container">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div className="logo-dot">H</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="brand">HIREO</div>
          <div className="small muted">Proctored hiring made simple</div>
        </div>
      </div>
      <nav className="nav-links">
        <Link href="/">Home</Link>
        {user?.role === "candidate" && (
          <>
            <Link href="/candidate">Jobs</Link>
            <Link href="/reports">Reports</Link>
            <Link href="/profile">Profile</Link>
          </>
        )}
        {user?.role === "recruiter" && (
          <>
            <Link href="/recruiter">Post Job</Link>
            <Link href="/recruiter/shortlist">Shortlist</Link>
            <Link href="/reports">Reports</Link>
          </>
        )}
        {user ? (
          <>
            <span className="muted">{user.username}</span>
            <a onClick={logout} style={{ cursor: "pointer" }}>
              Logout
            </a>
          </>
        ) : (
          <>
            <Link href="/auth/login">Login</Link>
            <Link href="/auth/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
