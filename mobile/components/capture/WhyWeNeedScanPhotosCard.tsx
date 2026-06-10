import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import {
  FACE_OUTLINE_DIAGRAM_URL,
  WHY_WE_NEED_SCAN_PHOTOS,
} from "@/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

const FACE_W = 100;
const FACE_H = 120;
const FACE_SCALE = 1.45;

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
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.labelBlock}>
      <Text style={styles.labelTitle}>{title}</Text>
      <Text style={styles.labelDesc}>{description}</Text>
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

      <View style={styles.diagramSection}>
        <View style={styles.faceRow}>
          <FaceDiagram />
        </View>

        <View style={styles.labelGrid}>
          <View style={styles.labelRow}>
            <View style={styles.labelCell}>
              <LabelBlock {...left[0]} />
            </View>
            <View style={styles.labelCell}>
              <LabelBlock {...right[0]} />
            </View>
          </View>
          <View style={styles.labelRow}>
            <View style={styles.labelCell}>
              <LabelBlock {...left[1]} />
            </View>
            <View style={styles.labelCell}>
              <LabelBlock {...right[1]} />
            </View>
          </View>
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
  diagramSection: {
    marginTop: 14,
    gap: 14,
  },
  faceRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagramClip: {
    width: FACE_W,
    height: FACE_H,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  faceDiagram: {
    width: FACE_W,
    height: FACE_H,
    transform: [{ scale: FACE_SCALE }],
  },
  labelGrid: {
    gap: 12,
  },
  labelRow: {
    flexDirection: "row",
    gap: 12,
  },
  labelCell: {
    flex: 1,
    minWidth: 0,
  },
  labelBlock: {
    gap: 2,
  },
  labelTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: NAVY,
    lineHeight: 15,
  },
  labelDesc: {
    fontSize: 10,
    lineHeight: 14,
    color: "#5C6478",
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(44,62,107,0.1)",
    alignItems: "center",
  },
});
