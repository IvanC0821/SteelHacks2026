import { Link } from "react-router-dom";
import { Wordmark } from "../../app/Wordmark";
import { LANDING_FOOTNOTE, LANDING_LINE, STAFF_STEPS, STUDENT_STEPS, type Step } from "./copy";
import "./landing.css";

/** The signed-out page. No session, no client, no data: one calm page on the design system.
 *  Exported on its own so the app can render it above the Shell, before there is an identity.
 *  `preview` lifts it over the shell so the page can be reviewed while signed in. */
export function Landing({ preview = false }: { preview?: boolean } = {}) {
  return (
    <div className={preview ? "v-landing-page v-landing-page--preview" : "v-landing-page"}>
      <main className="v-landing-inner" id={preview ? undefined : "main"}>
        <Wordmark size="lg" />
        <p className="v-copy-16 v-landing-line">{LANDING_LINE}</p>

        <div className="v-landing-columns">
          <Steps title="For students" steps={STUDENT_STEPS} />
          <Steps title="For instructors and TAs" steps={STAFF_STEPS} />
        </div>

        <Link to="/session" className="v-landing-continue">
          Continue
        </Link>

        <p className="v-label-12 v-landing-footnote">{LANDING_FOOTNOTE}</p>
      </main>
    </div>
  );
}

function Steps({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <section className="v-landing-steps">
      <h2 className="v-heading-14">{title}</h2>
      <ol>
        {steps.map((step) => (
          <li key={step.n} className="v-landing-step">
            <span className="v-landing-step-num v-score" aria-hidden="true">
              {step.n}
            </span>
            <span className="v-copy-14">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
