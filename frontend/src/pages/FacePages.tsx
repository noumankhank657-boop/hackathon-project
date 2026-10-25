import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/hcm";
import type { Employee } from "../api/types";
import { Button, Card, EmptyState, ErrorAlert, FormError, LoadingState, PageHeading } from "../components/Feedback";
import { FaceCameraStage, FaceStatusChip, faceDescriptorForOneFace } from "../face/FaceUI";
import { useFaceSession } from "../face/useFaceSession";
import { useResource } from "../hooks/useResource";

export function FaceRegistrationPage() {
  const face = useFaceSession();
  const profile = useResource<Employee>(() => api.employees.me());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  const descriptor = faceDescriptorForOneFace(face.faces);
  const canEnroll = Boolean(face.cameraReady && face.faceCount === 1 && face.blinkVerified && descriptor?.length === 128);

  async function enroll() {
    if (!canEnroll || !descriptor) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      await api.employees.enrollFace(descriptor);
      setSuccess(true);
      profile.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading title="Register my face" description="Enroll a face descriptor for camera attendance." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <Card title="Face enrollment" subtitle="Look straight into the oval and blink when prompted.">
          {success ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Face descriptor enrolled. No photo was stored or sent.</p> : null}
          <FormError error={error} />
          <FaceCameraStage face={face} description="Only a 128-number face descriptor is sent to the backend. Video stays in this browser; no photo is captured or stored." />
          <Button className="mt-4" disabled={!canEnroll || pending} onClick={() => void enroll()}>
            {pending ? "Registering…" : "Capture descriptor and register"}
          </Button>
        </Card>
        <Card title="Privacy and readiness">
          {profile.loading ? <LoadingState label="Checking enrollment status…" /> : profile.error ? <FormError error={profile.error} /> : !profile.data ? (
            <EmptyState title="Profile information is unavailable" />
          ) : (
            <div className="grid gap-4">
              <FaceStatusChip label="Current enrollment" value={profile.data.faceDescriptor ? "Registered" : "Not registered"} tone={profile.data.faceDescriptor ? "good" : "pending"} />
              <p className="text-sm leading-6 text-slate-600">The descriptor is stored on your employee record and compared by the server at camera check-in. You can register again to replace it.</p>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Browser camera access requires localhost or HTTPS. Allow camera permission when prompted.</p>
              <Link to="/face/check-in" className="button button-secondary">Continue to camera check-in</Link>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

type Coordinates = { latitude: number; longitude: number; accuracy: number };

function getLocation() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location services."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser settings."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your current location is unavailable. Check device location services."
            : "Location lookup timed out. Try again outdoors or with better GPS reception.";
        reject(new Error(`${message} Camera and location need HTTPS or localhost.`));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function rejectionLabel(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("outside the office radius")) return "Rejected: outside office radius";
  if (normalized.includes("accuracy")) return "Rejected: GPS accuracy";
  if (normalized.includes("face match")) return "Rejected: face mismatch";
  if (normalized.includes("blink")) return "Rejected: blink check";
  if (normalized.includes("face")) return "Rejected: face count or enrollment";
  if (normalized.includes("office location")) return "Rejected: office location not configured";
  return "Rejected by server";
}

export function CameraCheckInPage() {
  const face = useFaceSession();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<unknown>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<unknown>(null);
  const [serverAccepted, setServerAccepted] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const descriptor = faceDescriptorForOneFace(face.faces);

  async function captureLocation() {
    setLocationLoading(true);
    setLocationError(null);
    setLocation(null);
    setServerAccepted(false);
    setServerMessage(null);
    try {
      setLocation(await getLocation());
    } catch (reason) {
      setLocationError(reason);
    } finally {
      setLocationLoading(false);
    }
  }

  async function submitCameraCheckIn() {
    setCheckInLoading(true);
    setCheckInError(null);
    setServerMessage(null);
    setServerAccepted(false);
    try {
      const result = await api.attendance.checkIn({
        source: "CAMERA",
        faceCount: face.faceCount,
        faceDescriptor: descriptor,
        blinkVerified: face.blinkVerified,
        lat: location?.latitude,
        lng: location?.longitude,
        accuracy: location?.accuracy,
      });
      setServerAccepted(true);
      setServerMessage(`Camera check-in accepted. Server attendance status: ${result.status.toLowerCase().replaceAll("_", " ")}.`);
    } catch (reason) {
      setCheckInError(reason);
      setServerMessage(reason instanceof Error ? rejectionLabel(reason.message) : "Rejected by server");
    } finally {
      setCheckInLoading(false);
    }
  }

  const accuracyValue = location ? `${Math.round(location.accuracy)} m` : "Not captured";
  const accuracyTone = !location ? "pending" : location.accuracy <= 100 ? "good" : "bad";
  const faceValue = face.faceCount === 0 ? "No face" : face.faceCount === 1 ? "Exactly one" : `${face.faceCount} faces`;

  return (
    <>
      <PageHeading title="Camera check-in" description="The browser detects one face and captures GPS. The server decides office radius, GPS accuracy, face match, and attendance time." />
      {serverMessage ? (
        <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${serverAccepted ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-950"}`}>{serverMessage}</p>
      ) : null}
      <FormError error={checkInError} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <Card title="Live camera" subtitle="Exactly one face and an enrolled descriptor are required.">
          <FaceCameraStage face={face} description="A live frame is analyzed locally. Only the current descriptor, face count, blink result and GPS coordinates are sent; no full photo is stored or transmitted." />
        </Card>
        <div className="grid content-start gap-5">
          <Card title="Location and liveness" subtitle="Office distance is calculated by the server, not this device.">
            <div className="flex flex-wrap gap-2">
              <FaceStatusChip label="Face detected" value={faceValue} tone={face.faceCount === 1 ? "good" : face.faceCount > 1 ? "bad" : "pending"} />
              <FaceStatusChip label="Office location" value={serverAccepted ? "Inside office (server accepted)" : serverMessage ? "Server rejected" : "Server check pending"} tone={serverAccepted ? "good" : serverMessage ? "bad" : "pending"} />
              <FaceStatusChip label="GPS accuracy" value={accuracyValue} tone={accuracyTone} />
              <FaceStatusChip label="Blink" value={face.blinkVerified ? "OK" : "Not yet"} tone={face.blinkVerified ? "good" : "pending"} />
            </div>
            {location ? <p className="mt-3 text-xs text-slate-500">Coordinates captured: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}. The server validates the office radius; it does not return a distance value.</p> : null}
            <FormError error={locationError} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={locationLoading} onClick={() => void captureLocation()}>{locationLoading ? "Getting location…" : "Get current location"}</Button>
              <Button disabled={!face.cameraReady || checkInLoading} onClick={() => void submitCameraCheckIn()}>{checkInLoading ? "Submitting…" : "Submit camera check-in"}</Button>
            </div>
            {!face.cameraReady ? <p className="mt-3 text-xs text-amber-800">Start the camera before submitting. If camera or location access is denied, use attendance correction.</p> : null}
            {location && location.accuracy > 100 ? <p className="mt-3 text-sm font-medium text-rose-700">GPS accuracy is worse than 100 m. The server will reject this check-in.</p> : null}
          </Card>
          <Card title="If check-in fails">
            <p className="text-sm leading-6 text-slate-600">The backend rejection reason is shown above. You can ask HR to correct the attendance record instead.</p>
            <Link className="button button-secondary mt-3" to="/attendance">Request an attendance correction</Link>
            <p className="mt-3 text-xs text-slate-400">Camera and location permission are available only on localhost or HTTPS.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
