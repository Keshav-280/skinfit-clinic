import QRCode from "qrcode";

export async function reportQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#242a5f",
      light: "#ffffff",
    },
  });
}
