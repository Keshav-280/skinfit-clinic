import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import {
  FACE_OUTLINE_DIAGRAM_URL,
  WHY_WE_NEED_SCAN_PHOTOS,
} from "@/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

function FaceDiagram() {
  return (
    <View style={styles.faceDiagramClip}>
      <Image
        source={{ uri: FACE_OUTLINE_DIAGRAM_URL }}
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

      <View style={styles.diagramGrid}>
        <View style={styles.labelTopLeft}>
          <LabelBlock {...left[0]} align="right" />
        </View>
        <View style={styles.labelTopRight}>
          <LabelBlock {...right[0]} align="left" />
        </View>
        <View style={styles.faceCenter}>
          <FaceDiagram />
        </View>
        <View style={styles.labelBottomLeft}>
          <LabelBlock {...left[1]} align="right" />
        </View>
        <View style={styles.labelBottomRight}>
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
  diagramGrid: {
    marginTop: 12,
    minHeight: 300,
    position: "relative",
  },
  faceCenter: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -130,
    marginTop: -130,
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagramClip: {
    width: 260,
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagram: {
    width: 260,
    height: 260,
    transform: [{ scale: 1.9 }],
  },
  labelTopLeft: {
    position: "absolute",
    left: 0,
    top: 8,
    width: "34%",
  },
  labelTopRight: {
    position: "absolute",
    right: 0,
    top: 8,
    width: "34%",
  },
  labelBottomLeft: {
    position: "absolute",
    left: 0,
    bottom: 8,
    width: "34%",
  },
  labelBottomRight: {
    position: "absolute",
    right: 0,
    bottom: 8,
    width: "34%",
  },
  labelLeft: { alignItems: "flex-start" },
  labelRight: { alignItems: "flex-end" },
  labelTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: NAVY,
  },
  labelDesc: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
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
