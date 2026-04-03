import Markdown from "react-native-markdown-display";
import { Linking, Platform, StyleSheet } from "react-native";

const ZINC_900 = "#18181b";

const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const incoming = StyleSheet.create({
  body: { color: ZINC_900, fontSize: 16, lineHeight: 23, marginTop: 0, marginBottom: 0 },
  paragraph: { marginTop: 0, marginBottom: 6, color: ZINC_900 },
  heading1: { color: ZINC_900, fontSize: 18, fontWeight: "700", marginBottom: 6, marginTop: 4 },
  heading2: { color: ZINC_900, fontSize: 17, fontWeight: "700", marginBottom: 4, marginTop: 4 },
  heading3: { color: ZINC_900, fontSize: 16, fontWeight: "700", marginBottom: 4, marginTop: 2 },
  strong: { fontWeight: "700", color: ZINC_900 },
  em: { fontStyle: "italic", color: ZINC_900 },
  bullet_list: { marginBottom: 4 },
  ordered_list: { marginBottom: 4 },
  list_item: { color: ZINC_900, fontSize: 16, lineHeight: 23 },
  link: { color: "#0d9488", textDecorationLine: "underline" },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#cbd5e1",
    paddingLeft: 10,
    marginVertical: 6,
    color: "#475569",
  },
  code_inline: {
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    fontFamily: mono,
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontFamily: mono,
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  hr: { backgroundColor: "#e2e8f0", height: 1, marginVertical: 10 },
});

const patient = StyleSheet.create({
  body: { color: "#fff", fontSize: 16, lineHeight: 23, marginTop: 0, marginBottom: 0 },
  paragraph: { marginTop: 0, marginBottom: 6, color: "#fff" },
  heading1: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6, marginTop: 4 },
  heading2: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 4, marginTop: 4 },
  heading3: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4, marginTop: 2 },
  strong: { fontWeight: "700", color: "#fff" },
  em: { fontStyle: "italic", color: "rgba(255,255,255,0.95)" },
  bullet_list: { marginBottom: 4 },
  ordered_list: { marginBottom: 4 },
  list_item: { color: "#fff", fontSize: 16, lineHeight: 23 },
  link: { color: "#a5f3fc", textDecorationLine: "underline" },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.45)",
    paddingLeft: 10,
    marginVertical: 6,
    color: "rgba(255,255,255,0.92)",
  },
  code_inline: {
    backgroundColor: "rgba(0,0,0,0.2)",
    color: "#ecfeff",
    fontFamily: mono,
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "rgba(0,0,0,0.22)",
    color: "#f0fdfa",
    fontFamily: mono,
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  hr: { backgroundColor: "rgba(255,255,255,0.35)", height: 1, marginVertical: 10 },
});

export type ChatMarkdownVariant = "patient" | "incoming";

export function ChatMessageMarkdown({
  text,
  variant,
}: {
  text: string;
  variant: ChatMarkdownVariant;
}) {
  const style = variant === "patient" ? patient : incoming;
  return (
    <Markdown
      style={style}
      onLinkPress={(url) => {
        void Linking.openURL(url);
        return false;
      }}
    >
      {text}
    </Markdown>
  );
}
