/**
 * ORION response schema — the provider-independent output contract.
 * Written within the common subset accepted by strict structured-output modes
 * (every object: additionalProperties false, all properties required; no
 * numeric/string length constraints). Enforcement by a provider is a
 * convenience: ORION's admission re-checks everything regardless.
 */
export const ORION_SCHEMA_NAME = "orion_response";
export const ORION_SCHEMA_VERSION = "orion-response-schema/0.2.0";

export const VERDICTS = ["SUPPORTED", "CONTRADICTED_BY_ESTABLISHED_LAW", "UNDETERMINED", "NOT_APPLICABLE"] as const;
export type Verdict = (typeof VERDICTS)[number];

const strings = { type: "array", items: { type: "string" } } as const;

export const ORION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["evidenceClass", "title", "verdict", "sections", "answerValues", "assumptions", "uncertainty", "openQuestions", "proposedExperiments"],
  properties: {
    evidenceClass: { type: "string", enum: ["UNVERIFIED_AI_EXPLANATION", "HYPOTHESIS"] },
    title: { type: "string" },
    verdict: { type: "string", enum: [...VERDICTS] },
    sections: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["heading", "lines"], properties: { heading: { type: "string" }, lines: strings } },
    },
    answerValues: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["name", "value", "unit"], properties: { name: { type: "string" }, value: { type: "number" }, unit: { type: "string" } } },
    },
    assumptions: strings,
    uncertainty: strings,
    openQuestions: strings,
    proposedExperiments: strings,
  },
} as const;
