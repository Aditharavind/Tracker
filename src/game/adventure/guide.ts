export type GuideStep = 0 | 1 | 2 | 3 | 4;

export type GuideEvidence = {
  moved: boolean;
  jumped: boolean;
  attacked: boolean;
  collected: boolean;
};

/** Advance only the action currently being taught, once per gameplay update. */
export function nextGuideStep(step: GuideStep, evidence: GuideEvidence): GuideStep {
  if (step === 4) return step;
  const completed = [evidence.moved, evidence.jumped, evidence.attacked, evidence.collected];
  return completed[step] ? (step + 1) as GuideStep : step;
}
