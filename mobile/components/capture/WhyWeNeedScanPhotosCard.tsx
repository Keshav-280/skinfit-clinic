import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

import { WHY_WE_NEED_SCAN_PHOTOS } from "@/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const LINE = "#7A94B8";
const DOT = NAVY;

function FaceDiagram() {
  return (
    <Svg width={168} height={200} viewBox="0 0 200 240" aria-hidden>
      <Ellipse cx="100" cy="88" rx="46" ry="56" stroke={LINE} strokeWidth="1.6" fill="none" />
      <Path
        d="M 68 132 C 62 152 58 172 54 192 M 132 132 C 138 152 142 172 146 192"
        stroke={LINE}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 54 192 C 72 204 86 208 100 208 C 114 208 128 204 146 192"
        stroke={LINE}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <Line x1="100" y1="36" x2="100" y2="208" stroke={LINE} strokeWidth="1.2" strokeDasharray="4 4" />
      <Line x1="18" y1="58" x2="54" y2="78" stroke={LINE} strokeWidth="1" />
      <Circle cx="54" cy="78" r="3" fill={DOT} />
      <Line x1="18" y1="58" x2="50" y2="118" stroke={LINE} strokeWidth="1" />
      <Circle cx="50" cy="118" r="3" fill={DOT} />
      <Line x1="18" y1="178" x2="54" y2="192" stroke={LINE} strokeWidth="1" />
      <Circle cx="54" cy="192" r="3" fill={DOT} />
      <Line x1="182" y1="58" x2="146" y2="78" stroke={LINE} strokeWidth="1" />
      <Circle cx="146" cy="78" r="3" fill={DOT} />
      <Line x1="182" y1="58" x2="150" y2="118" stroke={LINE} strokeWidth="1" />
      <Circle cx="150" cy="118" r="3" fill={DOT} />
      <Line x1="182" y1="178" x2="146" y2="192" stroke={LINE} strokeWidth="1" />
      <Circle cx="146" cy="192" r="3" fill={DOT} />
    </Svg>
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
    backgroundColor: "#F7F9FC",
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
    minHeight: 220,
    position: "relative",
  },
  faceCenter: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -84,
    marginTop: -100,
    width: 168,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  labelTopLeft: {
    position: "absolute",
    left: 0,
    top: 8,
    width: "30%",
  },
  labelTopRight: {
    position: "absolute",
    right: 0,
    top: 8,
    width: "30%",
  },
  labelBottomLeft: {
    position: "absolute",
    left: 0,
    bottom: 8,
    width: "30%",
  },
  labelBottomRight: {
    position: "absolute",
    right: 0,
    bottom: 8,
    width: "30%",
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
