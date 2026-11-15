/**
 * LOKAL TEST: Epoint `/result` callback-ini simulyasiya edir (real imza + məbləğ yoxlaması + dispatcher yolu).
 *   npx tsx scripts/epointSimulateResult.ts <transactionId> <amountAzn> [success|failed] [baseUrl]
 * Məbləğ Transaction.amountAznCents / 100 olmalıdır (fərqli olsa /result AMOUNT_MISMATCH verir — o da test edilə bilər).
 * ⚠️ Yalnız lokal server üçün: baseUrl localhost deyilsə işləmir. EPOINT_PRIVATE_KEY serverinki ilə eyni olmalıdır.
 */
import { createSignedEpointPayload } from "../lib/epoint";

async function main() {
  const [txId, amountRaw, outcome = "success", base = "http://localhost:3000"] = process.argv.slice(2);
  if (!txId || !amountRaw) {
    console.error("İstifadə: tsx scripts/epointSimulateResult.ts <txId> <amountAzn> [success|failed] [baseUrl]");
    process.exit(1);
  }
  const host = new URL(base).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error("Yalnız lokal server (localhost) üçündür.");
    process.exit(1);
  }
  const privateKey = (process.env.EPOINT_PRIVATE_KEY ?? "").trim();
  if (!privateKey) {
    console.error("EPOINT_PRIVATE_KEY təyin edin (lokal serverdəki ilə eyni).");
    process.exit(1);
  }
  const ok = outcome !== "failed";
  const signed = createSignedEpointPayload(
    {
      order_id: txId,
      status: ok ? "success" : "failed",
      code: ok ? "000" : "100",
      message: ok ? "Approved" : "Declined",
      transaction: `sim-${Date.now()}`,
      amount: Number(amountRaw),
    },
    privateKey,
  );
  const res = await fetch(`${base.replace(/\/$/, "")}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(signed),
  });
  console.log(res.status, await res.text());
}

void main();
