import { createHash, timingSafeEqual } from "crypto";

export type EpointResultData = Record<string, unknown>;

export type EpointLanguage = "az" | "en" | "ru";

export type EpointPaymentRequest = {
  public_key: string;
  amount: number;
  currency: "AZN";
  language: EpointLanguage;
  order_id: string;
  description?: string;
  success_redirect_url?: string;
  error_redirect_url?: string;
};

export type EpointCheckoutResponse = {
  status?: string;
  transaction?: string;
  redirect_url?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
};

const EPOINT_REQUEST_URL = "https://epoint.az/api/1/request";

export function createEpointSignature(data: string, privateKey: string) {
  return createHash("sha1")
    .update(`${privateKey}${data}${privateKey}`)
    .digest("base64");
}

export function verifyEpointSignature(
  data: string,
  signature: string,
  privateKey: string,
) {
  const expected = Buffer.from(createEpointSignature(data, privateKey));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function decodeEpointData(data: string): EpointResultData {
  const raw = Buffer.from(data, "base64").toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as EpointResultData;
}

export function encodeEpointData(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function createSignedEpointPayload(
  payload: Record<string, unknown>,
  privateKey: string,
) {
  const data = encodeEpointData(payload);
  return {
    data,
    signature: createEpointSignature(data, privateKey),
  };
}

export function getEpointConfig() {
  const publicKey = process.env.EPOINT_PUBLIC_KEY?.trim();
  const privateKey = process.env.EPOINT_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export async function createEpointCheckout(
  payload: EpointPaymentRequest,
  privateKey: string,
): Promise<EpointCheckoutResponse> {
  const signed = createSignedEpointPayload(payload, privateKey);
  const response = await fetch(EPOINT_REQUEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(signed),
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: EpointCheckoutResponse;

  try {
    parsed = JSON.parse(text) as EpointCheckoutResponse;
  } catch {
    parsed = {
      status: "error",
      message: text || `Epoint HTTP ${response.status}`,
    };
  }

  if (!response.ok) {
    return {
      ...parsed,
      status: parsed.status ?? "error",
      message: parsed.message ?? `Epoint HTTP ${response.status}`,
    };
  }

  return parsed;
}

export function epointResultIsSuccess(payload: EpointResultData) {
  const status = String(payload.status ?? "").toLowerCase();
  const code = String(payload.code ?? "").toLowerCase();
  return status === "success" || code === "success" || code === "000";
}

export function readEpointOrderId(payload: EpointResultData) {
  const value =
    payload.order_id ??
    payload.orderId ??
    payload.order ??
    payload.transaction_id ??
    payload.transaction;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readEpointAmountCents(payload: EpointResultData) {
  const raw = payload.amount;
  const amount = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}
