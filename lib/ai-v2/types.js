"use strict";

/**
 * AI Engine V2 — epistemic labels and SEE public DTO notes.
 * No legacy reasoning imports.
 */

const TRUST = Object.freeze({
  FACT: "FACT",
  POSSIBILITY: "POSSIBILITY",
  USER_CONFIRMED: "USER_CONFIRMED",
  UNSUPPORTED: "UNSUPPORTED",
});

const SEE_OUTPUT_STATUS = Object.freeze({
  OBSERVATION: "observation",
  INSUFFICIENT: "insufficient",
  ERROR: "error",
});

/** Existing journal.bodyMind-compatible public fields (no schema change). */
const BODY_MIND_PUBLIC_FIELDS = Object.freeze([
  "insight",
  "support",
  "status",
  "seeType",
  "evidence",
  "confidence",
]);

module.exports = {
  TRUST,
  SEE_OUTPUT_STATUS,
  BODY_MIND_PUBLIC_FIELDS,
};
