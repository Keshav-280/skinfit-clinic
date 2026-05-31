import { StyleSheet, Text, View } from "react-native";

import { ReportContainImage } from "@/components/ReportContainImage";
import {
  ACNE_MASK_PANEL_LABEL,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/lib/scanMaskLabels";
import {
  legacyMaskTitleCropImageStyle,
  maskLikelyHasMatplotlibTitle,
  SCAN_MASK_FRAME_ASPECT,
} from "@/lib/maskImageCrop";

function MaskPanel({
  uri,
  fallbackUri,
  caption,
  authToken,
}: {
  uri: string;
  fallbackUri?: string;
  caption: string;
  authToken?: string | null;
}) {
  const cropLegacyTitle = maskLikelyHasMatplotlibTitle(uri);
  return (
    <View style={styles.item}>
      <View style={styles.imageClip}>
        <ReportContainImage
          imageUrl={uri}
          fallbackImageUrl={fallbackUri}
          authToken={authToken}
          resizeMode={cropLegacyTitle ? "cover" : "contain"}
          style={StyleSheet.absoluteFillObject}
          imageStyle={cropLegacyTitle ? legacyMaskTitleCropImageStyle() : undefined}
        />
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
  wrinkleFallbackUri,
  acneFallbackUri,
  authToken = null,
  wrinkleLabel = WRINKLE_MASK_PANEL_LABEL,
  acneLabel = ACNE_MASK_PANEL_LABEL,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  wrinkleFallbackUri?: string;
  acneFallbackUri?: string;
  authToken?: string | null;
  wrinkleLabel?: string;
  acneLabel?: string;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  if (!wrinkle && !acne) return null;

  return (
    <View style={styles.wrap}>
      {wrinkle ? (
        <MaskPanel
          uri={wrinkle}
          fallbackUri={wrinkleFallbackUri}
          caption={wrinkleLabel}
          authToken={authToken}
        />
      ) : null}
      {acne ? (
        <MaskPanel
          uri={acne}
          fallbackUri={acneFallbackUri}
          caption={acneLabel}
          authToken={authToken}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    width: "100%",
    gap: 20,
  },
  item: {
    width: "100%",
    alignItems: "center",
  },
  imageClip: {
    position: "relative",
    width: "100%",
    maxWidth: 340,
    aspectRatio: SCAN_MASK_FRAME_ASPECT,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
