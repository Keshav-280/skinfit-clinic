import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchAuthenticatedScanImageUri } from "@/lib/fetchAuthenticatedScanImage";
import { requiresBearerAuthForImage, toAbsoluteApiUrl } from "@/lib/resolveScanImage";

type Props = {
  /** Direct source when already a data:/file: URI or public URL. */
  source?: ImageSourcePropType;
  /** API path or URL — fetched with Bearer when needed. */
  imageUrl?: string;
  /** If primary load fails, try this URL once (e.g. face capture photo). */
  fallbackImageUrl?: string;
  authToken?: string | null;
  maxWidth?: number;
  style?: ImageStyle;
  imageStyle?: ImageStyle;
  resizeMode?: "contain" | "cover" | "stretch";
};

/**
 * Report photo: natural aspect ratio. Loads authenticated API images via
 * download-to-cache (RN Image does not reliably send Authorization headers).
 */
export function ReportContainImage({
  source,
  imageUrl,
  fallbackImageUrl,
  authToken,
  maxWidth = 320,
  style,
  imageStyle,
  resizeMode = "contain",
}: Props) {
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [resolvedUri, setResolvedUri] = useState<string | null>(() => {
    if (source && typeof source === "object" && "uri" in source) {
      const u = source.uri;
      if (typeof u === "string" && u.length > 0) {
        if (
          u.startsWith("data:") ||
          u.startsWith("file:") ||
          u.startsWith("content:") ||
          !requiresBearerAuthForImage(toAbsoluteApiUrl(u))
        ) {
          return u;
        }
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(
    Boolean(imageUrl?.trim()) && !resolvedUri
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = imageUrl?.trim();
    if (!url) return;

    if (
      url.startsWith("data:") ||
      url.startsWith("file:") ||
      url.startsWith("content:")
    ) {
      setResolvedUri(url);
      setLoading(false);
      setFailed(false);
      return;
    }

    if (!requiresBearerAuthForImage(toAbsoluteApiUrl(url))) {
      setResolvedUri(
        url.startsWith("http") ? url : toAbsoluteApiUrl(url)
      );
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const fallback = fallbackImageUrl?.trim();
    const tryFetch = async (target: string) =>
      fetchAuthenticatedScanImageUri(target, authToken ?? null);

    void (async () => {
      try {
        const uri = await tryFetch(url);
        if (!cancelled) {
          setResolvedUri(uri);
          setLoading(false);
          setFailed(false);
        }
      } catch {
        if (fallback && fallback !== url) {
          try {
            const uri = await tryFetch(fallback);
            if (!cancelled) {
              setResolvedUri(uri);
              setLoading(false);
              setFailed(false);
            }
            return;
          } catch {
            /* use failed state below */
          }
        }
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, fallbackImageUrl, authToken]);

  const displaySource: ImageSourcePropType | null = resolvedUri
    ? { uri: resolvedUri }
    : source ?? null;

  const fillParent = resizeMode === "cover" || resizeMode === "stretch";

  if (loading) {
    return (
      <View
        style={[
          styles.wrap,
          styles.placeholder,
          fillParent ? styles.fill : { maxWidth },
          style,
        ]}
      >
        <ActivityIndicator color="#2C3E6B" />
      </View>
    );
  }

  if (failed || !displaySource) {
    return (
      <View
        style={[
          styles.wrap,
          styles.placeholder,
          fillParent ? styles.fill : { maxWidth },
          style,
        ]}
      >
        <Text style={styles.failText}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, fillParent ? styles.fill : { maxWidth }, style]}>
      <Image
        source={displaySource}
        style={[
          fillParent ? styles.imgFill : styles.img,
          fillParent ? undefined : { aspectRatio },
          imageStyle,
        ]}
        resizeMode={resizeMode}
        onLoad={(e) => {
          const w = e.nativeEvent.source.width;
          const h = e.nativeEvent.source.height;
          if (w > 0 && h > 0) setAspectRatio(w / h);
        }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignSelf: "center",
    overflow: "hidden",
  },
  placeholder: {
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
  },
  failText: {
    fontSize: 12,
    color: "#71717a",
    textAlign: "center",
    padding: 12,
  },
  fill: {
    width: "100%",
    height: "100%",
    maxWidth: undefined,
  },
  img: {
    width: "100%",
    backgroundColor: "transparent",
  },
  imgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
});
