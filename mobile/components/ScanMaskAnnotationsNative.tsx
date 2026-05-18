import { Image, StyleSheet, Text, View } from "react-native";

import type { ScanSpatialOutputs } from "@/lib/spatialOutputs";

function fmt15(v: number) {
  return v.toFixed(1);
}

export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
  spatialOutputs,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  if (!wrinkle && !acne) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Model masks</Text>
      <View style={wrinkle && acne ? styles.grid2 : styles.grid1}>
        {wrinkle ? (
          <View style={styles.cell}>
            <View style={[styles.frame, styles.wrinkleRing]}>
              <Image source={{ uri: wrinkle }} style={styles.img} resizeMode="cover" />
            </View>
            <Text style={styles.captionTitle}>224×224 pixel map</Text>
            <Text style={styles.captionSub}>(segmentation head)</Text>
            {spatialOutputs?.wrinkles ? (
              <Text style={styles.meta}>
                Cls {fmt15(spatialOutputs.wrinkles.cls_severity_1_5)} · Seg{" "}
                {fmt15(spatialOutputs.wrinkles.seg_severity_1_5)} · Combined{" "}
                {fmt15(spatialOutputs.wrinkles.combined_severity_1_5)}
              </Text>
            ) : null}
          </View>
        ) : null}
        {acne ? (
          <View style={styles.cell}>
            <View style={[styles.frame, styles.acneRing]}>
              <Image source={{ uri: acne }} style={styles.img} resizeMode="cover" />
            </View>
            <Text style={styles.captionTitle}>16×16 patch grid</Text>
            <Text style={styles.captionSub}>(detection head)</Text>
            {spatialOutputs?.acne ? (
              <Text style={styles.meta}>
                Global {fmt15(spatialOutputs.acne.global_severity_1_5)} · Grid mean{" "}
                {spatialOutputs.acne.patch_mean.toFixed(3)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  kicker: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: "#2C3E6B",
    marginBottom: 12,
  },
  grid2: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  grid1: { alignItems: "center" },
  cell: { width: 150, alignItems: "center" },
  frame: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 1,
  },
  wrinkleRing: { borderColor: "rgba(124,58,237,0.45)" },
  acneRing: { borderColor: "rgba(234,88,12,0.45)" },
  img: { width: "100%", height: "100%" },
  captionTitle: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#4c1d95",
    textAlign: "center",
  },
  captionSub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },
  meta: {
    marginTop: 4,
    fontSize: 9,
    lineHeight: 13,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 4,
  },
});
