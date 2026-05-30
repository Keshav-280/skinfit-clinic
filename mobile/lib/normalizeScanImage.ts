import { ImageManipulator, SaveFormat, FlipType } from "expo-image-manipulator";

/** Bake EXIF orientation into pixels before upload (matches server sharp.rotate). */
export async function normalizeScanImageUri(uri: string): Promise<string> {
  const imageRef = await ImageManipulator.manipulate(uri).renderAsync();
  const saved = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.9,
  });
  return saved.uri;
}

/** Front-camera stills are unmirrored; flip so review/upload match the live selfie preview (web FaceScanFlow). */
export async function prepareCapturedScanPhotoUri(
  uri: string,
  facing: "front" | "back"
): Promise<string> {
  if (facing !== "front") return uri;
  const flipped = await ImageManipulator.manipulate(uri)
    .flip(FlipType.Horizontal)
    .renderAsync();
  const saved = await flipped.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.88,
  });
  return saved.uri;
}
