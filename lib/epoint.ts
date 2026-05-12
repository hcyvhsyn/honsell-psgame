import { createHash, timingSafeEqual } from "crypto";

export type EpointResultData = Record<string, unknown>;

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
