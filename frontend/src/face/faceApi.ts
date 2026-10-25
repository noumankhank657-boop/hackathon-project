export type FaceObservation = {
  descriptor: number[];
  eyeAspectRatio: number;
};

let modelLoadPromise: Promise<void> | null = null;
let faceApiModulePromise: Promise<typeof import("@vladmandic/face-api")> | null = null;

function getFaceApi() {
  if (!faceApiModulePromise) {
    faceApiModulePromise = import("@vladmandic/face-api").catch((error: unknown) => {
      faceApiModulePromise = null;
      throw error;
    });
  }
  return faceApiModulePromise;
}

export function loadFaceModels() {
  if (!modelLoadPromise) {
    modelLoadPromise = getFaceApi()
      .then((faceapi) => Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]))
      .then(() => undefined)
      .catch((error: unknown) => {
        modelLoadPromise = null;
        throw error;
      });
  }
  return modelLoadPromise;
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(points: Array<{ x: number; y: number }>) {
  if (points.length !== 6) return 0;
  const verticalA = pointDistance(points[1], points[5]);
  const verticalB = pointDistance(points[2], points[4]);
  const horizontal = pointDistance(points[0], points[3]);
  if (horizontal === 0) return 0;
  return (verticalA + verticalB) / (2 * horizontal);
}

export async function detectFaceObservations(video: HTMLVideoElement): Promise<FaceObservation[]> {
  const faceapi = await getFaceApi();
  const results = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((result) => ({
    descriptor: Array.from(result.descriptor),
    eyeAspectRatio: (eyeAspectRatio(result.landmarks.getLeftEye()) + eyeAspectRatio(result.landmarks.getRightEye())) / 2,
  }));
}

export class BlinkTracker {
  private sawOpenEyes = false;
  private sawClosedEyes = false;
  private completed = false;

  update(eyeAspectRatio: number) {
    if (this.completed) return true;
    if (eyeAspectRatio >= 0.25) {
      if (this.sawClosedEyes && this.sawOpenEyes) {
        this.completed = true;
        return true;
      }
      this.sawOpenEyes = true;
      this.sawClosedEyes = false;
      return false;
    }
    if (eyeAspectRatio <= 0.19 && this.sawOpenEyes) this.sawClosedEyes = true;
    return false;
  }

  reset() {
    this.sawOpenEyes = false;
    this.sawClosedEyes = false;
    this.completed = false;
  }
}
