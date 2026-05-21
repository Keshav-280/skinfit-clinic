import { StyleSheet, View } from "react-native";

import { OrientedReportImage } from "@/components/OrientedReportImage";

/** Mask PNGs already include matplotlib titles (from dual-scan API). */
export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  if (!wrinkle && !acne) return null;

  return (
    <View style={styles.wrap}>
      <View style={wrinkle && acne ? styles.grid2 : styles.grid1}>
        {wrinkle ? (
          <View style={styles.cell}>
            <View style={styles.frame}>
              <OrientedReportImage uri={wrinkle} style={styles.img} resizeMode="contain" />
            </View>
          </View>
        ) : null}
        {acne ? (
          <View style={styles.cell}>
            <View style={styles.frame}>
              <OrientedReportImage uri={acne} style={styles.img} resizeMode="contain" />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, paddingHorizontal: 4 },
  grid2: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  grid1: { alignItems: "center" },
  cell: { width: 168, maxWidth: "48%" },
  frame: {
    width: "100%",
    minHeight: 200,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  img: { width: "100%", height: 220 },
});
