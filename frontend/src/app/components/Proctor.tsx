"use client";
import React, { useEffect, useRef, useState } from "react";

function ProctorInner({
  sessionId,
  onFaceCount,
  onMultiFace,
}: {
  sessionId: string;
  onFaceCount?: (count: number) => void;
  onMultiFace?: (count: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("idle");
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    let interval: number | undefined;

    async function startCamera() {
      try {
        setStatus("requesting-permission");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStreamActive(true);
        setStatus("recording");

        // capture snapshot every 10 seconds
        interval = window.setInterval(captureAndSend, 10000);
      } catch (err) {
        console.error(err);
        setStatus("permission-denied");
      }
    }

    // attempt to load face-api.js from CDN as a fallback if native FaceDetector not available
    async function loadFaceApiFallback() {
      try {
        if ((window as any).FaceDetector) return; // native available
        if ((window as any).faceapi) return; // already loaded
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/face-api.js/dist/face-api.min.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("face-api load failed"));
          document.head.appendChild(s);
        });
        // try to load tiny face detector model from /models (optional)
        try {
          // @ts-ignore
          await (window as any).faceapi.nets.tinyFaceDetector.loadFromUri(
            "/models",
          );
        } catch (e) {
          // fallback to CDN-hosted models if local models are not present
          try {
            // @ts-ignore
            await (window as any).faceapi.nets.tinyFaceDetector.loadFromUri(
              "https://justadudewhohacks.github.io/face-api.js/models",
            );
            console.info("loaded face-api models from CDN");
          } catch (e2) {
            console.warn("face-api models not found locally or on CDN", e2);
          }
        }
      } catch (e) {
        console.warn("face-api fallback failed", e);
      }
    }

    function handleVisibility() {
      const event = {
        type: "visibility",
        state: document.visibilityState,
        time: Date.now(),
        sessionId,
      };
      navigator.sendBeacon("/api/proctor", JSON.stringify(event));
    }

    function handleBlur() {
      const event = {
        type: "window",
        state: "blur",
        time: Date.now(),
        sessionId,
      };
      navigator.sendBeacon("/api/proctor", JSON.stringify(event));
    }

    function handleFocus() {
      const event = {
        type: "window",
        state: "focus",
        time: Date.now(),
        sessionId,
      };
      navigator.sendBeacon("/api/proctor", JSON.stringify(event));
    }

    loadFaceApiFallback().catch(() => {});
    startCamera();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", () => {
      const event = { type: "unload", time: Date.now(), sessionId };
      navigator.sendBeacon("/api/proctor", JSON.stringify(event));
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (interval) window.clearInterval(interval);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function captureAndSend() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = 320;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 240;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const form = new FormData();
        form.append("image", blob, "capture.jpg");
        form.append("sessionId", sessionId);

        // Attempt face detection client-side if available (Chromium FaceDetector)
        try {
          if ((window as any).FaceDetector) {
            const bitmap = await createImageBitmap(canvas);
            const fd = new (window as any).FaceDetector();
            const faces = await fd.detect(bitmap);
            const cnt = (faces && faces.length) || 0;
            form.append("face_count", String(cnt));
            if (onFaceCount) onFaceCount(cnt);
            if (cnt > 1 && onMultiFace) onMultiFace(cnt);
            navigator.sendBeacon(
              "/api/proctor",
              JSON.stringify({
                type: "face_count",
                sessionId,
                count: cnt,
                time: Date.now(),
              }),
            );
          } else if (
            (window as any).faceapi &&
            (window as any).faceapi.detectAllFaces
          ) {
            try {
              // @ts-ignore
              const detections = await (window as any).faceapi.detectAllFaces(
                canvas,
                new (window as any).faceapi.TinyFaceDetectorOptions(),
              );
              const cnt = detections ? detections.length : 0;
              form.append("face_count", String(cnt));
              if (onFaceCount) onFaceCount(cnt);
              if (cnt > 1 && onMultiFace) onMultiFace(cnt);
              navigator.sendBeacon(
                "/api/proctor",
                JSON.stringify({
                  type: "face_count",
                  sessionId,
                  count: cnt,
                  time: Date.now(),
                }),
              );
            } catch (e) {
              console.warn("faceapi detect error", e);
            }
          }
        } catch (e) {
          // ignore face detection errors
          console.warn("face detect error", e);
        }

        fetch("/api/proctor", { method: "POST", body: form }).catch(
          console.error,
        );
      },
      "image/jpeg",
      0.7,
    );
  }

  return (
    <div className="proctor card-soft">
      <div className="flex gap-4 items-center">
        <div
          className="bg-black/5 rounded overflow-hidden"
          style={{ width: 180, height: 120 }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Live proctoring</div>
          <div className="text-xs text-zinc-500">
            Status: <strong>{status}</strong> • Session {sessionId}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              className="rounded bg-indigo-600 px-3 py-1 text-white"
              onClick={() => captureAndSend()}
            >
              Capture now
            </button>
            <button
              className="rounded border px-3 py-1"
              onClick={() => {
                if (videoRef.current && videoRef.current.srcObject) {
                  const tracks = (
                    videoRef.current.srcObject as MediaStream
                  ).getTracks();
                  tracks.forEach((t) => t.stop());
                  setStreamActive(false);
                  setStatus("stopped");
                }
              }}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-500">
        Keep your face clearly visible and avoid switching tabs. All captures
        and focus changes are logged for recruiter review.
      </div>
    </div>
  );
}

const Proctor = React.memo(ProctorInner);

export default Proctor;
