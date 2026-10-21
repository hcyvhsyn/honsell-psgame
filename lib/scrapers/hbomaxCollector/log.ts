/**
 * `[HBO] ...` prefiksli strukturlaşdırılmış log. Hər brauzer sorğusu log
 * olunmur — yalnız mərhələlər və yekun saylar.
 */

type Fields = Record<string, string | number | boolean | undefined>;

function format(msg: string, fields?: Fields): string {
  if (!fields) return msg;
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `${msg} (${parts.join(", ")})` : msg;
}

export const hboLog = {
  info(msg: string, fields?: Fields) {
    console.log(`[HBO] ${format(msg, fields)}`);
  },
  warn(msg: string, fields?: Fields) {
    console.warn(`[HBO] ⚠ ${format(msg, fields)}`);
  },
  error(msg: string, fields?: Fields) {
    console.error(`[HBO] ✖ ${format(msg, fields)}`);
  },
  debug(msg: string, fields?: Fields) {
    if (process.env.HBOMAX_DEBUG === "1") console.log(`[HBO] · ${format(msg, fields)}`);
  },
};
