import { StyleSheet, Text, View } from "react-native";

import { ReportContainImage } from "@/components/ReportContainImage";

const TITLE_CROP_PX = 32;

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
  return (
    <View style={styles.item}>
      <View style={styles.imageClip}>
        <View style={styles.imageShift}>
          <ReportContainImage
            imageUrl={uri}
            fallbackImageUrl={fallbackUri}
            authToken={authToken}
            maxWidth={340}
          />
        </View>
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
  wrinkleLabel = "Wrinkle mask (smiling)",
  acneLabel = "Acne objectness (centre)",
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
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
  },
  imageShift: {
    marginTop: -TITLE_CROP_PX,
    paddingBottom: 0,
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
