import { useCallback, useEffect, useRef, useState } from "react";
import { BlinkTracker, detectFaceObservations, loadFaceModels, type FaceObservation } from "./faceApi";

function describeCameraError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No front-facing camera was found on this device.";
  }
  return error instanceof Error ? error.message : "Unable to start the camera.";
}

export function useFaceSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef(false);
  const blinkTrackerRef = useRef(new BlinkTracker());
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [faces, setFaces] = useState<FaceObservation[]>([]);
  const [blinkVerified, setBlinkVerified] = useState(false);

  useEffect(() => {
    let active = true;
    setModelsLoading(true);
    loadFaceModels()
      .then(() => {
        if (active) setModelsReady(true);
      })
      .catch((error: unknown) => {
        if (active) setModelsError(error instanceof Error ? error.message : "Unable to load local face models.");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setFaces([]);
    setBlinkVerified(false);
    blinkTrackerRef.current.reset();
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraReady || !modelsReady) return undefined;
    let active = true;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || processingRef.current) return;
      processingRef.current = true;
      void detectFaceObservations(video)
        .then((observations) => {
          if (!active) return;
          setFaces(observations);
          if (observations.length !== 1) {
            blinkTrackerRef.current.reset();
            setBlinkVerified(false);
            return;
          }
          if (blinkTrackerRef.current.update(observations[0].eyeAspectRatio)) setBlinkVerified(true);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setDetectionError(error instanceof Error ? error.message : "Face detection failed.");
          window.clearInterval(interval);
        })
        .finally(() => {
          processingRef.current = false;
        });
    }, 450);
    return () => {
      active = false;
      window.clearInterval(interval);
      processingRef.current = false;
    };
  }, [cameraReady, modelsReady]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setDetectionError(null);
    setFaces([]);
    setBlinkVerified(false);
    blinkTrackerRef.current.reset();

    const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!window.isSecureContext && !localHost) {
      setCameraError("Camera access requires HTTPS or localhost. Open this app over a secure connection.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access. Use a recent browser over HTTPS or localhost.");
      return;
    }

    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraError("Camera preview is not ready. Reload the page and try again.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (error) {
      setCameraError(`${describeCameraError(error)} Camera and location need HTTPS or localhost.`);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } finally {
      setCameraStarting(false);
    }
  }, []);

  return {
    videoRef,
    modelsLoading,
    modelsReady,
    modelsError,
    cameraReady,
    cameraStarting,
    cameraError,
    detectionError,
    faces,
    faceCount: faces.length,
    blinkVerified,
    startCamera,
    stopCamera,
  };
}
