import { StyleSheet, Text, View } from "react-native";

import { ReportContainImage } from "@/components/ReportContainImage";
import {
  ACNE_MASK_PANEL_LABEL,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/lib/scanMaskLabels";
import {
  legacyMaskTitleCropImageStyle,
  shouldCropLegacyMaskTitle,
  SCAN_FACE_FRAME_ASPECT,
} from "@/lib/maskImageCrop";

function MaskPanel({
  uri,
  fallbackUri,
  caption,
  authToken,
  maskExportVersion,
}: {
  uri: string;
  fallbackUri?: string;
  caption: string;
  authToken?: string | null;
  maskExportVersion?: number | null;
}) {
  const cropLegacyTitle = shouldCropLegacyMaskTitle(uri, maskExportVersion);
  const panelAspect = cropLegacyTitle ? 1 : SCAN_FACE_FRAME_ASPECT;
  return (
    <View style={styles.item}>
      <View style={[styles.imageClip, { aspectRatio: panelAspect }]}>
        <ReportContainImage
          imageUrl={uri}
          fallbackImageUrl={fallbackUri}
          authToken={authToken}
          resizeMode={cropLegacyTitle ? "contain" : "cover"}
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
  maskExportVersion,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  wrinkleFallbackUri?: string;
  acneFallbackUri?: string;
  authToken?: string | null;
  wrinkleLabel?: string;
  acneLabel?: string;
  maskExportVersion?: number | null;
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
          maskExportVersion={maskExportVersion}
        />
      ) : null}
      {acne ? (
        <MaskPanel
          uri={acne}
          fallbackUri={acneFallbackUri}
          caption={acneLabel}
          authToken={authToken}
          maskExportVersion={maskExportVersion}
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
