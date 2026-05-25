import { useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  StyleSheet,
  View,
} from "react-native";

type Props = {
  source: ImageSourcePropType;
  /** Max width for the photo (full width of parent up to this). */
  maxWidth?: number;
  style?: ImageStyle;
};

/**
 * Report photo: natural aspect ratio, no gray letterbox frame.
 * `contain` inside a box sized to the image dimensions.
 */
export function ReportContainImage({ source, maxWidth = 320, style }: Props) {
  const [aspectRatio, setAspectRatio] = useState(3 / 4);

  return (
    <View style={[styles.wrap, { maxWidth }]}>
      <Image
        source={source}
        style={[styles.img, { aspectRatio }, style]}
        resizeMode="contain"
        onLoad={(e) => {
          const w = e.nativeEvent.source.width;
          const h = e.nativeEvent.source.height;
          if (w > 0 && h > 0) setAspectRatio(w / h);
        }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignSelf: "center",
    overflow: "hidden",
  },
  img: {
    width: "100%",
    backgroundColor: "transparent",
  },
});
