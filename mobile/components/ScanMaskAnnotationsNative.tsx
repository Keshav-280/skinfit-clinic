import { StyleSheet, Text, View } from "react-native";

import { ReportContainImage } from "@/components/ReportContainImage";

const TITLE_CROP_PX = 32;

function MaskPanel({
  uri,
  caption,
}: {
  uri: string;
  caption: string;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.imageClip}>
        <View style={styles.imageShift}>
          <ReportContainImage source={{ uri }} maxWidth={340} />
        </View>
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
  wrinkleLabel = "Wrinkle mask (smiling)",
  acneLabel = "Acne objectness (centre)",
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  wrinkleLabel?: string;
  acneLabel?: string;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  if (!wrinkle && !acne) return null;

  return (
    <View style={styles.wrap}>
      {wrinkle ? <MaskPanel uri={wrinkle} caption={wrinkleLabel} /> : null}
      {acne ? <MaskPanel uri={acne} caption={acneLabel} /> : null}
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
