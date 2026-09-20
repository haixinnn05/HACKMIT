"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import jsQR from "jsqr";
import { Camera, ImageSquare, X } from "@phosphor-icons/react";
import { openScannedPassAction } from "@/app/actions";

/**
 * Reads the QR on a participant's ticket.
 *
 * Two ways in, because phones are strict about cameras. Live video needs a
 * secure page (https or localhost); where that is not available, taking a photo
 * of the code works on any connection and is decoded the same way, on this
 * device. No image leaves the phone.
 *
 * A code is only ever trusted for the token inside it. Whatever address the QR
 * claims, the passport is opened on this app, so a hostile code cannot send a
 * coordinator somewhere else.
 */

const TOKEN = /\/handoff\/([A-Za-z0-9_-]{8,128})(?:[/?#]|$)/;

const noSubscription = () => () => {};
const liveCameraAvailable = () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

function tokenFrom(text: string): string | null {
  return text.match(TOKEN)?.[1] ?? null;
}

function decode(source: CanvasImageSource, width: number, height: number, canvas: HTMLCanvasElement): string | null {
  // Large photos are scaled down: the decoder is faster and no less accurate.
  const scale = Math.min(1, 1280 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export function PassScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const [live, setLive] = useState(false);
  // Read on the client only; the server render assumes no camera, which is the safe layout.
  const canGoLive = useSyncExternalStore(noSubscription, liveCameraAvailable, () => false);
  const [message, setMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setLive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const found = useCallback((text: string) => {
    const token = tokenFrom(text);
    if (!token) {
      setMessage("That is a QR code, but not a Mozaic passport. Ask them to open their ticket and try again.");
      return false;
    }
    stop();
    setOpening(true);
    setMessage(null);
    void openScannedPassAction(token);
    return true;
  }, [stop]);

  const start = async () => {
    setMessage(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = media;
      setLive(true);
      const element = video.current!;
      element.srcObject = media;
      await element.play();
      const tick = () => {
        if (!stream.current || !canvas.current) return;
        if (element.readyState >= 2 && element.videoWidth) {
          const text = decode(element, element.videoWidth, element.videoHeight, canvas.current);
          if (text && found(text)) return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (error) {
      stop();
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setMessage(denied
        ? "Camera access was not allowed. You can allow it in your browser settings, take a photo of the code instead, or type the pass number."
        : "The camera could not be started. Take a photo of the code instead, or type the pass number.");
    }
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file || !canvas.current) return;
    setMessage(null);
    try {
      const bitmap = await createImageBitmap(file);
      const text = decode(bitmap, bitmap.width, bitmap.height, canvas.current);
      bitmap.close();
      if (!text) setMessage("No code found in that photo. Fill the frame with the QR, hold steady, and try again.");
      else found(text);
    } catch {
      setMessage("That photo could not be read. Try again, or type the pass number.");
    }
  };

  return (
    <div className="mt-3.5 space-y-2.5">
      <canvas ref={canvas} className="hidden" aria-hidden />

      <div className={live ? "relative overflow-hidden rounded-[18px] bg-ink" : "hidden"}>
        {/* playsInline keeps iOS from taking the video full screen */}
        <video ref={video} playsInline muted className="aspect-square w-full object-cover" aria-label="Camera view. Point it at the QR code on their ticket." />
        <span aria-hidden className="pointer-events-none absolute inset-[16%] rounded-[22px] border-[3px] border-white/90 shadow-[0_0_0_999px_rgba(14,13,99,0.35)]" />
        <button type="button" onClick={stop} className="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-full bg-white/90 text-ink">
          <X size={18} weight="bold" /><span className="sr-only">Stop the camera</span>
        </button>
      </div>

      {opening ? (
        <p role="status" className="rounded-[14px] bg-mint-soft px-4 py-3 text-[13px] font-bold text-ink">Code read. Opening their passport…</p>
      ) : (
        <>
          {canGoLive && !live ? (
            <button type="button" onClick={start} className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
              <Camera size={18} weight="bold" /> Scan with camera
            </button>
          ) : null}
          {!live ? (
            <label className={`press inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[14.5px] font-bold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-iris ${canGoLive ? "border border-rule-strong bg-surface text-ink" : "cta text-white"}`}>
              {canGoLive ? <ImageSquare size={18} weight="bold" /> : <Camera size={18} weight="bold" />}
              {canGoLive ? "Use a photo instead" : "Take a photo of the code"}
              <input type="file" accept="image/*" capture="environment" className="sr-only"
                onChange={(event) => { void fromPhoto(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
          ) : (
            <p className="text-center text-[12.5px] text-ink-soft">Hold their code inside the square. It opens by itself.</p>
          )}
        </>
      )}

      {message ? <p role="alert" className="text-[12.5px] font-semibold leading-relaxed text-blush">{message}</p> : null}
    </div>
  );
}
