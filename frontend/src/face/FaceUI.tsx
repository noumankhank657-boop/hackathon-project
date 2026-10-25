import type { FaceObservation } from "./faceApi";
import type { useFaceSession } from "./useFaceSession";
import { Button, ErrorAlert } from "../components/Feedback";

type FaceSession = ReturnType<typeof useFaceSession>;

export function FaceStatusChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" | "pending" }) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bad: "border-rose-200 bg-rose-50 text-rose-800",
    pending: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <span className={`inline-flex flex-wrap items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles[tone]}`}><span>{label}:</span><span>{value}</span></span>;
}

export function FaceCameraStage({ face, description }: { face: FaceSession; description: string }) {
  const statusText = face.modelsLoading
    ? "Loading face models…"
    : !face.modelsReady
      ? "Local face models are not available."
      : !face.cameraReady
        ? "Start the front camera, then look straight at the oval."
        : face.faceCount === 0
          ? "Look straight into the camera."
          : face.faceCount > 1
            ? "More than one face detected. Only one person may be in frame."
            : !face.blinkVerified
              ? "Look straight, then blink now."
              : "One face detected and blink verified.";
  const faceTone = face.faceCount === 1 ? "good" : face.faceCount > 1 ? "bad" : "pending";
  const blinkTone = face.blinkVerified ? "good" : "pending";

  return (
    <div className="grid gap-4">
      {face.modelsError ? (
        <ErrorAlert message={`Unable to load local face models: ${face.modelsError}. Confirm the required files exist in frontend/public/models.`} />
      ) : null}
      {face.cameraError ? <ErrorAlert message={face.cameraError} /> : null}
      {face.detectionError ? <ErrorAlert message={`Face detection stopped: ${face.detectionError}`} /> : null}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl bg-slate-950">
        <video
          ref={face.videoRef}
          className={`h-full w-full object-cover ${face.cameraReady ? "-scale-x-100" : ""}`}
          autoPlay
          muted
          playsInline
          aria-label="Front camera preview"
        />
        {!face.cameraReady ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/90 px-5 text-center text-sm text-white">
            {face.modelsLoading ? "Loading local camera models…" : "Camera preview will appear here after permission is granted."}
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-[62%] w-[45%] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_999px_rgba(15,23,42,0.24)]" />
        </div>
        {face.cameraReady && face.faceCount === 1 ? (
          <div className="absolute left-3 top-3 rounded-full bg-emerald-600/95 px-3 py-1.5 text-xs font-bold text-white">Exactly one face detected</div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <FaceStatusChip label="Face detected" value={`${face.faceCount}`} tone={faceTone} />
        <FaceStatusChip label="Blink" value={face.blinkVerified ? "OK" : "Not yet"} tone={blinkTone} />
      </div>
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{statusText}</p>
      <p className="text-sm text-slate-500">{description}</p>
      <div className="flex flex-wrap gap-2">
        {!face.cameraReady ? (
          <Button type="button" disabled={face.modelsLoading || !face.modelsReady || face.cameraStarting} onClick={() => void face.startCamera()}>
            {face.cameraStarting ? "Opening camera…" : "Start front camera"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={face.stopCamera}>Stop camera</Button>
        )}
      </div>
    </div>
  );
}

export function faceDescriptorForOneFace(faces: FaceObservation[]) {
  return faces.length === 1 ? faces[0].descriptor : undefined;
}
