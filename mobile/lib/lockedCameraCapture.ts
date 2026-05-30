import type { CameraView } from "expo-camera";

type TakePictureOptions = NonNullable<Parameters<CameraView["takePictureAsync"]>[0]>;
type TakePictureResult = Awaited<ReturnType<CameraView["takePictureAsync"]>>;

/** Single-flight mutex — expo-camera rejects concurrent takePictureAsync calls. */
let locked = false;
const queue: Array<() => void> = [];

async function acquireCaptureLock(): Promise<void> {
  if (!locked) {
    locked = true;
    return;
  }
  await new Promise<void>((resolve) => {
    queue.push(resolve);
  });
  locked = true;
}

function releaseCaptureLock(): void {
  const next = queue.shift();
  if (next) next();
  else locked = false;
}

export async function lockedTakePictureAsync(
  camera: CameraView,
  options?: TakePictureOptions
): Promise<TakePictureResult> {
  await acquireCaptureLock();
  try {
    return await camera.takePictureAsync(options);
  } finally {
    releaseCaptureLock();
  }
}
