// Validates the only structured executor output eligible for public task receipts.
import { Buffer } from "node:buffer";

const TASK_COMPLETION_RECEIPT_SCHEMA_VERSION = "q_completion_receipt/v1" as const;
const TASK_COMPLETION_RECEIPT_MAX_BYTES = 16_384;
const TASK_COMPLETION_RECEIPT_MAX_ITEMS = 20;
const TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES = 1_000;
const TASK_COMPLETION_RECEIPT_EVIDENCE_MAX_BYTES = 512;

const TASK_COMPLETION_RECEIPT_OUTCOMES = new Set([
  "completed",
  "stopped_safely",
  "blocked",
  "failed",
] as const);

export type TaskCompletionReceipt = {
  schema_version: typeof TASK_COMPLETION_RECEIPT_SCHEMA_VERSION;
  outcome: "completed" | "stopped_safely" | "blocked" | "failed";
  work_performed: string[];
  mutations_made: string[];
  authoritative_state_observed: string[];
  stopping_reason: string;
  remaining_work: string[];
  evidence_references: string[];
};

const RECEIPT_KEYS = new Set<keyof TaskCompletionReceipt>([
  "schema_version",
  "outcome",
  "work_performed",
  "mutations_made",
  "authoritative_state_observed",
  "stopping_reason",
  "remaining_work",
  "evidence_references",
]);

function isBoundedString(value: unknown, maxBytes: number): value is string {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maxBytes;
}

function isBoundedStringArray(value: unknown, maxItemBytes: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= TASK_COMPLETION_RECEIPT_MAX_ITEMS &&
    value.every((item) => isBoundedString(item, maxItemBytes))
  );
}

function isTaskCompletionReceipt(value: unknown): value is TaskCompletionReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== RECEIPT_KEYS.size ||
    Object.keys(record).some((key) => !RECEIPT_KEYS.has(key as keyof TaskCompletionReceipt))
  ) {
    return false;
  }
  return (
    record.schema_version === TASK_COMPLETION_RECEIPT_SCHEMA_VERSION &&
    typeof record.outcome === "string" &&
    TASK_COMPLETION_RECEIPT_OUTCOMES.has(record.outcome as TaskCompletionReceipt["outcome"]) &&
    isBoundedStringArray(record.work_performed, TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES) &&
    isBoundedStringArray(record.mutations_made, TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES) &&
    isBoundedStringArray(
      record.authoritative_state_observed,
      TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES,
    ) &&
    isBoundedString(record.stopping_reason, TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES) &&
    isBoundedStringArray(record.remaining_work, TASK_COMPLETION_RECEIPT_TEXT_MAX_BYTES) &&
    isBoundedStringArray(record.evidence_references, TASK_COMPLETION_RECEIPT_EVIDENCE_MAX_BYTES)
  );
}

/**
 * Accept only a complete final JSON payload. Never scan assistant prose for an
 * embedded object: that would turn arbitrary transcript text into public data.
 */
export function parseTaskCompletionReceipt(
  finalText: string | null | undefined,
): TaskCompletionReceipt | undefined {
  const normalized = finalText?.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > TASK_COMPLETION_RECEIPT_MAX_BYTES) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(normalized);
    if (!isTaskCompletionReceipt(parsed)) {
      return undefined;
    }
    if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > TASK_COMPLETION_RECEIPT_MAX_BYTES) {
      return undefined;
    }
    return structuredClone(parsed);
  } catch {
    return undefined;
  }
}
