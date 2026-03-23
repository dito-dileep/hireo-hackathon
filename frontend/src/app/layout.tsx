import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "HIREO",
    template: "%s | HIREO",
  },
  description:
    "AI-assisted proctored hiring platform for recruiters and candidates.",
  applicationName: "HIREO",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const aiEnabled = !!process.env.OPENAI_API_KEY;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* Navbar + container */}
        <div className="site-wrapper">
          <Navbar />
          {!aiEnabled && (
            <div
              className="card"
              style={{
                margin: "16px auto 0",
                maxWidth: 960,
                border: "1px solid rgba(239,68,68,0.5)",
                background: "rgba(239,68,68,0.06)",
              }}
            >
              <div className="font-medium">AI grading disabled</div>
              <div className="small muted">
                Set <code>OPENAI_API_KEY</code> to enable AI grading and resume
                matching.
              </div>
            </div>
          )}
          { }
          <main className="site-container">{children}</main>
        </div>
      </body>
    </html>
  );
}
