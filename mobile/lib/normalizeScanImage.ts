import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Bake EXIF orientation into pixels before upload (matches server sharp.rotate). */
export async function normalizeScanImageUri(uri: string): Promise<string> {
  const imageRef = await ImageManipulator.manipulate(uri).renderAsync();
  const saved = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.9,
  });
  return saved.uri;
}
