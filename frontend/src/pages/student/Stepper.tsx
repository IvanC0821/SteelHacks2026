const STEPS = ["Upload", "Assign pages", "Check"];

export interface StepperProps {
  /** 1, 2 or 3 */
  current: number;
}

/** The three steps of a practice run, shown in the workspace header row. */
export function Stepper({ current }: StepperProps) {
  return (
    <ol className="v-student-stepper" aria-label={`Step ${current} of ${STEPS.length}`}>
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step === current ? "is-current" : step < current ? "is-done" : "";
        return (
          <li key={label} className={`v-student-stepper__step ${state}`.trim()} aria-current={step === current}>
            <span className="v-student-stepper__number">{step}</span>
            <span className="v-label-12 v-student-stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
