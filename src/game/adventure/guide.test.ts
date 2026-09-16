import { describe, expect, it } from "vitest";
import { nextGuideStep, type GuideEvidence, type GuideStep } from "./guide";

const idle: GuideEvidence = { moved: false, jumped: false, attacked: false, collected: false };
const actions = ["moved", "jumped", "attacked", "collected"] as const;

describe("learn by playing guide", () => {
  it("teaches moving, jumping, smashing and collecting in that order", () => {
    let step: GuideStep = 0;
    for (const [index, action] of actions.entries()) {
      step = nextGuideStep(step, { ...idle, [action]: true });
      expect(step).toBe(index + 1);
    }
  });

  it("keeps the current instruction until its action actually happens", () => {
    for (const [index, action] of actions.entries()) {
      const step = index as GuideStep;
      expect(nextGuideStep(step, idle)).toBe(step);
      for (const unrelated of actions.filter(candidate => candidate !== action)) {
        expect(nextGuideStep(step, { ...idle, [unrelated]: true })).toBe(step);
      }
    }
  });

  it("does not skip instructions when multiple actions happen together", () => {
    const everything: GuideEvidence = { moved: true, jumped: true, attacked: true, collected: true };
    expect(nextGuideStep(0, everything)).toBe(1);
    expect(nextGuideStep(1, everything)).toBe(2);
    expect(nextGuideStep(2, everything)).toBe(3);
    expect(nextGuideStep(3, everything)).toBe(4);
  });

  it("does not remember actions performed before their instruction", () => {
    const step = nextGuideStep(0, { ...idle, moved: true, jumped: true });
    expect(nextGuideStep(step, idle)).toBe(1);
    expect(nextGuideStep(step, { ...idle, jumped: true })).toBe(2);
  });

  it("stays complete during further play", () => {
    expect(nextGuideStep(4, idle)).toBe(4);
    for (const action of actions) expect(nextGuideStep(4, { ...idle, [action]: true })).toBe(4);
  });
});
