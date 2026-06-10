import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import {
  FACE_OUTLINE_DIAGRAM_IMAGE,
  WHY_WE_NEED_SCAN_PHOTOS,
} from "@/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

const FACE_W = 92;
const FACE_H = 124;

function FaceDiagram() {
  return (
    <View style={styles.faceDiagramClip}>
      <Image
        source={FACE_OUTLINE_DIAGRAM_IMAGE}
        style={styles.faceDiagram}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function LabelBlock({
  title,
  description,
  align,
}: {
  title: string;
  description: string;
  align: "left" | "right";
}) {
  return (
    <View style={align === "right" ? styles.labelRight : styles.labelLeft}>
      <Text style={[styles.labelTitle, align === "right" && styles.textRight]}>{title}</Text>
      <Text style={[styles.labelDesc, align === "right" && styles.textRight]}>{description}</Text>
    </View>
  );
}

type Props = {
  footer?: ReactNode;
};

export function WhyWeNeedScanPhotosCard({ footer }: Props) {
  const { title, subtitle, left, right } = WHY_WE_NEED_SCAN_PHOTOS;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.diagramRow}>
        <View style={styles.diagramSide}>
          <LabelBlock {...left[0]} align="right" />
          <LabelBlock {...left[1]} align="right" />
        </View>

        <View style={styles.faceCenter}>
          <FaceDiagram />
        </View>

        <View style={styles.diagramSide}>
          <LabelBlock {...right[0]} align="left" />
          <LabelBlock {...right[1]} align="left" />
        </View>
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.1)",
    backgroundColor: "#FFFFFF",
    padding: 16,
    overflow: "hidden",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#5C6478",
    textAlign: "center",
  },
  diagramRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  diagramSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
    gap: 16,
    minHeight: FACE_H,
  },
  faceCenter: {
    width: FACE_W,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagramClip: {
    width: FACE_W,
    height: FACE_H,
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagram: {
    width: FACE_W,
    height: FACE_H,
  },
  labelLeft: { alignItems: "flex-start" },
  labelRight: { alignItems: "flex-end" },
  labelTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: NAVY,
    lineHeight: 14,
  },
  labelDesc: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 13,
    color: "#5C6478",
  },
  textRight: {
    textAlign: "right",
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(44,62,107,0.1)",
    alignItems: "center",
  },
});
