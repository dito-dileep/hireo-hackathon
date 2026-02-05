import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  getSubmissionsForSession,
  getProctorLogsForSession,
  getJobs,
} from "../../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId required" },
        { status: 400 },
      );
    }

    const submissions = getSubmissionsForSession(sessionId);
    if (!submissions.length) {
      return NextResponse.json(
        { ok: false, error: "no submissions" },
        { status: 404 },
      );
    }
    const latest = submissions[submissions.length - 1];
    const logs = getProctorLogsForSession(sessionId);
    const jobs = getJobs();
    const jobTitle =
      jobs.find((j: any) => j.id === latest.jobId)?.title || latest.jobId;

    const visibilityEvents = logs.filter(
      (l: any) =>
        l.type === "visibility" ||
        (l.payload && l.payload.type === "visibility"),
    ).length;
    const captures = logs.filter(
      (l: any) => l.type === "capture" && l.image_base64,
    ).length;

    // Build PDF in memory using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 60;

    page.drawText("HIREO Candidate Report", {
      x: 50,
      y,
      size: 20,
      font,
      color: rgb(0.1, 0.1, 0.3),
    });
    y -= 30;

    const small = 11;

    page.drawText(`Candidate: ${latest.candidateUsername || "Unknown"}`, {
      x: 50,
      y,
      size: small,
      font,
    });
    y -= 16;
    page.drawText(`Job: ${jobTitle}`, { x: 50, y, size: small, font });
    y -= 16;
    page.drawText(`Session: ${sessionId}`, { x: 50, y, size: small, font });
    y -= 24;

    page.drawText("Scores", {
      x: 50,
      y,
      size: small,
      font,
      color: rgb(0.1, 0.1, 0.3),
    });
    y -= 16;
    page.drawText(`Overall score: ${latest.score ?? "—"}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 14;
    page.drawText(`Technical: ${latest.technicalScore ?? "—"}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 14;
    page.drawText(`Reasoning: ${latest.reasoningScore ?? "—"}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 14;
    page.drawText(`Passed: ${latest.passed ? "Yes" : "No"}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 22;

    page.drawText("Integrity summary", {
      x: 50,
      y,
      size: small,
      font,
      color: rgb(0.1, 0.1, 0.3),
    });
    y -= 16;
    page.drawText(
      `Tab/window switches: ${
        typeof latest.tabSwitches === "number" ? latest.tabSwitches : 0
      }`,
      { x: 60, y, size: small, font },
    );
    y -= 14;
    page.drawText(`Visibility events: ${visibilityEvents}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 14;
    page.drawText(`Camera captures: ${captures}`, {
      x: 60,
      y,
      size: small,
      font,
    });
    y -= 22;

    if (latest.explanation) {
      page.drawText("Decision rationale", {
        x: 50,
        y,
        size: small,
        font,
        color: rgb(0.1, 0.1, 0.3),
      });
      y -= 16;

      const text = String(latest.explanation);
      const maxWidth = width - 80;
      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, small);
        if (textWidth > maxWidth) {
          page.drawText(line, { x: 60, y, size: small, font });
          y -= 14;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, { x: 60, y, size: small, font });
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hireo-report-${sessionId}.pdf"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
