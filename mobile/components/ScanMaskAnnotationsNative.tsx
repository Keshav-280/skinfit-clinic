import { Image, StyleSheet, Text, View } from "react-native";

import type { ScanSpatialOutputs } from "@/lib/spatialOutputs";
import {
  ACNE_MASK_COPY,
  COMBINED_OVERLAY_COPY,
  SCAN_MASK_SECTION,
  WRINKLE_MASK_COPY,
} from "@/lib/scanMaskLabels";

function fmt15(v: number) {
  return v.toFixed(1);
}

function CaptionBlock({
  title,
  subtitle,
  body,
  note,
  meta,
  titleColor,
  subColor,
}: {
  title: string;
  subtitle: string;
  body: string;
  note?: string;
  meta?: string;
  titleColor: string;
  subColor: string;
}) {
  return (
    <View style={styles.captionBlock}>
      <Text style={[styles.captionTitle, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.captionSub, { color: subColor }]}>{subtitle}</Text>
      <Text style={styles.captionBody}>{body}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

export function ScanMaskAnnotationsNative({
  wrinkleMaskUri,
  acneMaskUri,
  overlayUri,
  spatialOutputs,
}: {
  wrinkleMaskUri?: string;
  acneMaskUri?: string;
  overlayUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
}) {
  const wrinkle = wrinkleMaskUri?.trim() || "";
  const acne = acneMaskUri?.trim() || "";
  const overlay = overlayUri?.trim() || "";
  if (!wrinkle && !acne && !overlay) return null;

  const wrMeta = spatialOutputs?.wrinkles
    ? `${WRINKLE_MASK_COPY.metaCls} ${fmt15(spatialOutputs.wrinkles.cls_severity_1_5)} · ${WRINKLE_MASK_COPY.metaSeg} ${fmt15(spatialOutputs.wrinkles.seg_severity_1_5)} · ${WRINKLE_MASK_COPY.metaCombined} ${fmt15(spatialOutputs.wrinkles.combined_severity_1_5)}\n${WRINKLE_MASK_COPY.metaHint}`
    : undefined;

  const acMeta = spatialOutputs?.acne
    ? `${ACNE_MASK_COPY.metaGlobal} ${fmt15(spatialOutputs.acne.global_severity_1_5)} · ${ACNE_MASK_COPY.metaGridMean} ${spatialOutputs.acne.patch_mean.toFixed(3)}`
    : undefined;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{SCAN_MASK_SECTION.title}</Text>
      <Text style={styles.intro}>{SCAN_MASK_SECTION.intro}</Text>

      {(wrinkle || acne) && (
        <View style={wrinkle && acne ? styles.grid2 : styles.grid1}>
          {wrinkle ? (
            <View style={styles.cell}>
              <View style={[styles.frame, styles.wrinkleRing]}>
                <Image source={{ uri: wrinkle }} style={styles.img} resizeMode="cover" />
              </View>
              <CaptionBlock
                title={WRINKLE_MASK_COPY.title}
                subtitle={WRINKLE_MASK_COPY.subtitle}
                body={WRINKLE_MASK_COPY.body}
                meta={wrMeta}
                titleColor="#4c1d95"
                subColor="#6d28d9"
              />
            </View>
          ) : null}
          {acne ? (
            <View style={styles.cell}>
              <View style={[styles.frame, styles.acneRing]}>
                <Image source={{ uri: acne }} style={styles.img} resizeMode="cover" />
              </View>
              <CaptionBlock
                title={ACNE_MASK_COPY.title}
                subtitle={ACNE_MASK_COPY.subtitle}
                body={ACNE_MASK_COPY.body}
                note={ACNE_MASK_COPY.pigmentationNote}
                meta={acMeta}
                titleColor="#9a3412"
                subColor="#c2410c"
              />
            </View>
          ) : null}
        </View>
      )}

      {overlay ? (
        <View style={styles.overlayBlock}>
          <Text style={styles.overlayTitle}>{COMBINED_OVERLAY_COPY.title}</Text>
          <Text style={styles.overlayBody}>{COMBINED_OVERLAY_COPY.body}</Text>
          {COMBINED_OVERLAY_COPY.bullets.map((line) => (
            <Text key={line} style={styles.bullet}>
              • {line}
            </Text>
          ))}
          <View style={[styles.frame, styles.overlayRing, styles.overlayFrame]}>
            <Image source={{ uri: overlay }} style={styles.img} resizeMode="cover" />
          </View>
          <Text style={styles.overlayNote}>{COMBINED_OVERLAY_COPY.pigmentationNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, paddingHorizontal: 4 },
  kicker: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    color: "#2C3E6B",
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
  captionSub: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  captionBody: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: "#52525b",
    textAlign: "center",
  },
  meta: {
    marginTop: 6,
    fontSize: 9,
    lineHeight: 13,
    color: "#3f3f46",
    textAlign: "center",
  },
  note: {
    marginTop: 6,
    fontSize: 9,
    lineHeight: 13,
    color: "#52525b",
    textAlign: "center",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
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
  overlayBody: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  bullet: {
    fontSize: 10,
    lineHeight: 14,
    color: "#52525b",
    textAlign: "center",
    marginTop: 2,
  },
  overlayNote: {
    marginTop: 8,
    fontSize: 9,
    lineHeight: 13,
    color: "#71717a",
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
