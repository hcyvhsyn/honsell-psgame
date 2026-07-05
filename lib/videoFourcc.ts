/**
 * MP4 video codec fourcc aşkarlaması — SAF funksiya (client + server ortaq).
 * Baytları skan edib stsd sample-description fourcc-ini tapır. Məqsəd: H.265/HEVC
 * (hvc1/hev1) videoları bloklamaq — Chrome/Firefox onları oynatmır.
 */
export type CodecInfo = {
  fourcc: string;
  browserSafe: boolean;
  isHevc: boolean;
};

const KNOWN = ["avc1", "hvc1", "hev1", "av01", "vp09", "vp08", "dvh1", "dvhe"];

export function detectFourccFromBytes(bytes: Uint8Array): CodecInfo {
  let text = "";
  const n = Math.min(bytes.length, 8 * 1024 * 1024);
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    text += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
  }
  let fourcc = "unknown";
  let firstIdx = Infinity;
  for (const code of KNOWN) {
    const idx = text.indexOf(code);
    if (idx >= 0 && idx < firstIdx) {
      firstIdx = idx;
      fourcc = code;
    }
  }
  const isHevc = fourcc === "hvc1" || fourcc === "hev1" || fourcc === "dvh1" || fourcc === "dvhe";
  const browserSafe = fourcc === "avc1" || fourcc === "av01" || fourcc === "vp09" || fourcc === "vp08";
  return { fourcc, browserSafe, isHevc };
}
