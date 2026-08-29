import { describe, expect, it } from "vitest";
import { parseTaskCompletionReceipt } from "./task-completion-receipt.js";

function validReceipt() {
  return {
    schema_version: "q_completion_receipt/v1",
    outcome: "completed",
    work_performed: ["Added the bounded handoff."],
    mutations_made: [],
    authoritative_state_observed: ["Repository tests passed."],
    stopping_reason: "Work is complete.",
    remaining_work: [],
    evidence_references: ["https://example.test/pr/1"],
  };
}

describe("parseTaskCompletionReceipt", () => {
  it("accepts an exact valid v1 final payload", () => {
    expect(parseTaskCompletionReceipt(JSON.stringify(validReceipt()))).toEqual(validReceipt());
  });

  it.each([
    ["assistant prose", `Done. ${JSON.stringify(validReceipt())}`],
    ["fenced JSON", `\`\`\`json\n${JSON.stringify(validReceipt())}\n\`\`\``],
    ["unknown field", JSON.stringify({ ...validReceipt(), transcript: "private" })],
    ["wrong version", JSON.stringify({ ...validReceipt(), schema_version: "v2" })],
    ["oversized item", JSON.stringify({ ...validReceipt(), work_performed: ["é".repeat(501)] })],
    [
      "oversized evidence",
      JSON.stringify({ ...validReceipt(), evidence_references: ["é".repeat(257)] }),
    ],
    [
      "too many entries",
      JSON.stringify({ ...validReceipt(), remaining_work: Array(21).fill("x") }),
    ],
    ["oversized payload", " ".repeat(16_385)],
  ])("rejects %s", (_label, payload) => {
    expect(parseTaskCompletionReceipt(payload)).toBeUndefined();
  });
});
