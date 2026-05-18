import { useEffect, useState } from "react";
import {
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  View,
} from "react-native";

/**
 * Mask overlays from older scans were saved without EXIF correction (landscape pixels).
 * If the decoded image is wider than tall, rotate 90° for portrait report frames.
 */
export function OrientedReportImage({
  uri,
  style,
  resizeMode = "cover",
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch";
}) {
  const [rotate90, setRotate90] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) setRotate90(width > height * 1.08);
      },
      () => {
        if (!cancelled) setRotate90(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <View style={[styles.clip, style]}>
      <Image
        source={{ uri }}
        style={[
          StyleSheet.absoluteFillObject,
          rotate90 ? styles.rotateFix : null,
        ]}
        resizeMode={resizeMode}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
  },
  rotateFix: {
    transform: [{ rotate: "90deg" }, { scale: 1.42 }],
  },
});
