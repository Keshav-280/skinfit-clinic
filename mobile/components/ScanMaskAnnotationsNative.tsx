import { StyleSheet, Text, View } from "react-native";

import { OrientedReportImage } from "@/components/OrientedReportImage";
import {
  ACNE_MASK_COPY,
  COMBINED_OVERLAY_COPY,
  SCAN_MASK_SECTION,
  WRINKLE_MASK_COPY,
} from "@/lib/scanMaskLabels";

function MaskCaption({
  title,
  hint,
  titleColor,
}: {
  title: string;
  hint: string;
  titleColor: string;
}) {
  return (
    <View style={styles.captionBlock}>
      <Text style={[styles.captionTitle, { color: titleColor }]}>{title}</Text>
      <Text style={styles.captionHint}>{hint}</Text>
    </View>
  );
}

export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
  overlayUri,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  overlayUri?: string;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  const overlay = overlayUri?.trim() || "";
  if (!wrinkle && !acne && !overlay) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{SCAN_MASK_SECTION.title}</Text>
      <Text style={styles.intro}>{SCAN_MASK_SECTION.intro}</Text>

      {(wrinkle || acne) && (
        <View style={wrinkle && acne ? styles.grid2 : styles.grid1}>
          {wrinkle ? (
            <View style={styles.cell}>
              <View style={[styles.frame, styles.wrinkleRing]}>
                <OrientedReportImage uri={wrinkle} style={styles.img} />
              </View>
              <MaskCaption
                title={WRINKLE_MASK_COPY.title}
                hint={WRINKLE_MASK_COPY.hint}
                titleColor="#4c1d95"
              />
            </View>
          ) : null}
          {acne ? (
            <View style={styles.cell}>
              <View style={[styles.frame, styles.acneRing]}>
                <OrientedReportImage uri={acne} style={styles.img} />
              </View>
              <MaskCaption
                title={ACNE_MASK_COPY.title}
                hint={ACNE_MASK_COPY.hint}
                titleColor="#9a3412"
              />
            </View>
          ) : null}
        </View>
      )}

      {overlay ? (
        <View style={styles.overlayBlock}>
          <Text style={styles.overlayTitle}>{COMBINED_OVERLAY_COPY.title}</Text>
          <Text style={styles.overlayHint}>{COMBINED_OVERLAY_COPY.hint}</Text>
          <View style={[styles.frame, styles.overlayRing, styles.overlayFrame]}>
            <OrientedReportImage uri={overlay} style={styles.img} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, paddingHorizontal: 4 },
  sectionTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
  },
  intro: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    color: "#52525b",
    paddingHorizontal: 8,
  },
  grid2: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  grid1: { marginTop: 14, alignItems: "center" },
  cell: { width: 158, alignItems: "center" },
  frame: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e4e4e7",
    borderWidth: 2,
  },
  wrinkleRing: { borderColor: "rgba(124,58,237,0.5)" },
  acneRing: { borderColor: "rgba(234,88,12,0.5)" },
  overlayRing: { borderColor: "rgba(113,113,122,0.45)", borderWidth: 1 },
  overlayFrame: { marginTop: 10, maxWidth: 280, alignSelf: "center", width: "100%" },
  img: { width: "100%", height: "100%" },
  captionBlock: { marginTop: 8, width: "100%" },
  captionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  captionHint: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: "#52525b",
    textAlign: "center",
  },
  overlayBlock: {
    marginTop: 20,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d4d4d8",
  },
  overlayTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "center",
  },
  overlayHint: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 4,
  },
});
