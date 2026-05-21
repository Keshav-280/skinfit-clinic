import {
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  View,
} from "react-native";

/** Model mask JPEGs are already upright — do not auto-rotate (breaks portrait overlays). */
export function OrientedReportImage({
  uri,
  style,
  resizeMode = "cover",
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch";
}) {
  return (
    <View style={[styles.clip, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
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
});
