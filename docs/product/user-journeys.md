# User Journeys — Emotional and Cognitive State Maps

**Status:** working document. Behavioral journey maps grounded in the founder-psychology, burnout, and behavioral-science research, plus the archetype taxonomy. Time horizons: minutes (within-session), days (within-week), weeks (within-month), months (across-quarter).

**Purpose:** identify, with specificity, *when* the user opens the product, *why* they stop, *what makes them feel understood*, *what makes them feel judged*, and *where the design has to absorb emotional load* rather than amplify it.

**Reading note:** these are journey *shapes*, not literal sequences. A real user moves through them non-linearly and re-enters earlier states. The product must support discontinuity.

---

## 1. The Within-Session Journey (minutes)

Time horizon: open-to-close in a single use.

### Stage 1 — Entry (0–10 seconds)

**Emotional state:** anywhere from "ritual habit, no charge" (morning capture) to "elevated activation, cognitively fragmented" (11pm dread check) to "post-crash shame and confusion" (crash recovery).

**Cognitive state:** depending on entry, ranges from intact to substantially impaired. Worst case: PFC down-regulated (Arnsten), meta-awareness compromised, working memory at 60–70% of capacity.

**What makes them feel understood at this stage:** instant load. The product has already done work; the user does not have to ask for it. The mirror state is *visible without input* — that is the design move.

**What makes them feel judged:** any prompt that asks them to characterize themselves before being given anything. "How are you feeling today?" at entry produces immediate aversion in this cohort.

**Failure modes:**
- Latency > 2 seconds. Drop-off in degraded states.
- Login or authentication friction. Faceswap kills this.
- An interstitial screen (weekly summary banner, promotional content) before the home read.

### Stage 2 — Encounter with current state (10–60 seconds)

**Emotional state:** brief activation of attention. The user is reading their own pattern. Two paths:
- *Recognition*: "yes, that tracks." Comfort, slight relief.
- *Surprise*: "I didn't realize." Mild orientation jolt; can go either toward insight or toward defensiveness.

**Cognitive state:** brief engagement of pattern recognition. Working memory used to compare current to past states.

**What makes them feel understood:** source-linked claims. The pattern is explained by data the user can verify. The user's intelligence is respected.

**What makes them feel judged:**
- Unsourced AI claims.
- Soft language ("you seem to be struggling").
- Anything that sounds like a manager's performance review.
- Any number or score out of a maximum.

**Failure modes:**
- The surfaced pattern is generic (could apply to anyone). Trust eroded.
- The surfaced pattern is wrong. Trust dies.
- The pattern reads as a venture-state signal (identity-fusion misread).

### Stage 3 — Optional engagement (60–180 seconds)

**Emotional state:** depending on user and entry, this is either skipped (closing the app), accepted (tapping into a deeper view), or actively engaged (capturing a thought, voice-recording, exploring a past entry).

**Cognitive state:** if continuing past 60s, the user has decided this is worth investment. Engagement increases.

**What makes them feel understood:** the depth available is real. The "tap to expand" reveals more than UI cosmetic. The AI explains its reasoning if asked.

**What makes them feel judged:** depth that turns into pressure to do more. The product saying "spend more time here" implicitly or explicitly.

**Failure modes:**
- Endless scroll. Sessions should end visibly.
- Hidden gates ("subscribe to see more") in the engagement path.
- Capture prompts that exceed 30 seconds when the user is in a degraded state.

### Stage 4 — Exit (variable)

**Emotional state:** ideally neutral-to-resolved. The user leaves having seen something useful, with no follow-up obligation.

**Cognitive state:** session ended cleanly; no open loops.

**What makes them feel understood:** an explicit closure. "That's enough looking for tonight" or "you've checked in; the next synthesis is on Sunday." The product respects that it is not the main thing in the user's life.

**What makes them feel judged:** any guilt-inducing exit. Streak counters. "You haven't completed your reflection." Loss-aversion copy.

**Failure modes:**
- Exit returns user to a home screen with a notification badge implying they're not done.
- Push notifications follow soon after exit, pulling them back in.
- The product attempts to retain them with content. Wellness-app trap.

### Critical session metric

The within-session journey is healthy if **median session time is 30–180 seconds** and the user leaves without an open loop. Sessions consistently > 5 minutes suggest the product is becoming a content trap — a category-failure signal.

---

## 2. The Within-Week Journey (days)

Time horizon: 7 days from first install.

### Day 0 — Install

**Emotional state:** mild curiosity, often paired with low expectation. "Let me see if this is actually different."

**Cognitive state:** intact (people don't install software at peak depletion). Open to setup.

**What makes them feel understood:** an onboarding flow that doesn't ask invasive questions. Lightweight setup that produces something visible immediately.

**What makes them feel judged:** survey-style onboarding ("which of these describes you?"). Mental health screening questions. Anything that feels like intake at a clinic.

**Critical action:** wearable connect, baseline biosignal pull, first 30-second capture. No deeper commitment yet.

### Day 1–3 — Cold-start trough

**Emotional state:** product is doing very little because data is thin. Risk of "is this it?" reaction.

**Cognitive state:** measuring whether the product earns continued attention.

**What makes them feel understood:** the product is explicit about its own cold-start. "I have 2 days of your data; here's what I can see; this gets better with more time."

**What makes them feel judged:** the product pretends to know more than it does. Fake pattern surfacings damage trust permanently here.

**Failure modes:**
- Aggressive AI claims at low data depth. (This is the single biggest first-week failure mode.)
- Empty-state screens with no clear path forward.
- Notification spam ("don't forget to check in!").

**Design move:** the first three days should be a *baseline-building* phase, framed as such. The product is gathering reference data. The user is told this explicitly and once. No further prompts.

### Day 4–6 — First weak insight window

**Emotional state:** some accumulated data; product can offer a first observation.

**Cognitive state:** the user is forming a judgment about whether to keep the product.

**What makes them feel understood:** a first observation that is specific, source-linked, and modest. "On the two days you reported high load, your sleep was ~70 minutes shorter than your other nights. Worth noting; not yet a pattern."

**What makes them feel judged:** an over-claimed observation. Or no observation at all.

**Failure modes:**
- Day 5 silence: no signal from the product. User concludes nothing is happening.
- Day 5 generic content: a "wellness tip" or "tip of the day." Wellness-app failure mode; uninstall driver.

### Day 7 — First weekly synthesis

**Emotional state:** moderate. The user is now evaluating whether the product produces unique value.

**Cognitive state:** ready to read 3 minutes of synthesis on a Sunday evening.

**What makes them feel understood:** a synthesis that contains *at least one* thing they did not already know, source-linked, calibrated.

**What makes them feel judged:** a synthesis that summarizes their own check-ins back to them with no added structure. Or one that is filler.

**Failure modes:**
- The synthesis can't produce a non-obvious observation at 7-day depth. **This is a real risk and a serious one.** If the first weekly synthesis can't carry its weight, retention collapses.
- The synthesis is too long or too short.
- The synthesis reads like a journal entry rather than an analysis.

**Critical metric:** **first-weekly-synthesis quality is the single most predictive signal of week-4 retention.** Disproportionate ML investment justified.

---

## 3. The Within-Month Journey (weeks)

Time horizon: weeks 2–4 post-install.

### Week 2 — Habit decision

**Emotional state:** the user is deciding implicitly whether this is a part of their life or a forgotten app. Habit formation in this cohort is fragile.

**Cognitive state:** the product has had enough chances to demonstrate value. Continued engagement requires accumulating reinforcement.

**What makes them feel understood:** patterns that connect across the week boundary. "This week looks like last week minus X; minus X coincided with Y."

**What makes them feel judged:** any reminder that emphasizes consistency over value. "You've checked in 6 days in a row" reframes the product as habit-tracker; alienates this cohort.

**Failure modes:**
- The week-2 synthesis is structurally identical to week-1. Looks lazy.
- AI patterns repeat. The user notices repetition before depth.
- A first "anomaly" surfacing that is wrong. Trust collapse.

**Insight moments:** the first cross-week pattern. A pattern observed across both weeks earns the product its standing.

### Week 3 — The doubt window

**Emotional state:** novelty has worn off. Behavioral reactivity (behavioral-science §1.2) is diminishing. The user is asking: "is this still giving me something?"

**Cognitive state:** capacity reasonably intact in many users; depleted in some.

**What makes them feel understood:** the product surfaces something at week 3 that the user could not have noticed without it. Specifically: a longer-arc pattern that requires the data depth they now have. The "you noticed something I didn't" moment.

**What makes them feel judged:** the product doubles down on engagement metrics. Push notifications to "stay consistent." Streaks. Encouragement.

**Failure modes:**
- The product offers nothing new at week 3. Drop-off accelerates.
- The product over-corrects with engagement nudges. Drop-off accelerates *faster*.
- The user has not had a wearable-derived insight (HRV trend, sleep deficit visible) and the product hasn't earned its data substrate yet. Trust shallow.

**Insight moment opportunity:** a longitudinal pattern across 21 days. This is the cleanest cohort-bonding moment available. Designers and ML should over-invest here.

### Week 4 — Retention threshold

**Emotional state:** by week 4, the user has either decided the product is "in their life" or has effectively stopped using it. Mid-state users churn in week 5.

**Cognitive state:** the user has stable expectations of what the product does.

**What makes them feel understood:** the product feels like an instrument they own, not an app they use. The vocabulary, the surfacing rhythm, the AI tone all feel consistent and earned.

**What makes them feel judged:** any feature expansion that feels off-brand. A new "wellness" surface added would be a churn driver. A pricing change would be one. Any communication that breaks the established voice would be one.

**Failure modes:**
- The product introduces new features the user didn't ask for. Distraction.
- A trust-eroding incident (wrong AI claim) lands now. Cumulative dissatisfaction → uninstall.
- The fourth weekly synthesis is structurally identical to the second. Boredom.

**Reflection fatigue is a real risk by week 4.** Some users will start skipping check-ins. The product must respond by *reducing demand*, not increasing it. A user who skips two consecutive check-ins should see lighter prompts, not heavier ones. (Counterintuitive vs typical retention design; correct for this cohort.)

---

## 4. The Across-Quarter Journey (months)

Time horizon: month 1 → month 6.

### Month 1: foundation

The user has formed a working relationship with the product. Trust is provisional. Value is real but fragile.

**Cognitive state:** stable. The product is an accepted but not deeply embedded part of the operating loop.

**Risk:** the product is liked but not yet load-bearing. Easy to drop.

### Month 2: data substrate accumulates

**Emotional state:** the product begins to do things that were impossible at the start. Pattern surfacing across 60 days. "This is the third time in two months that X has preceded Y."

**Critical metric:** **the first 60-day-pattern observation is the single most powerful retention event in the user's first six months.** If the product successfully surfaces a cross-month pattern that the user recognizes and didn't see, the product moves from "useful tool" to "instrument I rely on."

**Failure modes:** if no 60-day pattern is surfaced (or if the ones surfaced are wrong), the product feels like a wellness app that ran out of ideas. Churn risk elevates.

### Month 3: the resistance test

**Emotional state:** the user has lived through some cycles. Resistance to the product's findings may emerge — particularly in the Suppression-Driven, Chaos-Adapted, and Recovery-Resistant archetypes.

**Cognitive state:** the user is challenging the product's claims.

**What makes them feel understood:** the product holds its line non-defensively. Surfaces the pattern; cites the data; does not argue.

**What makes them feel judged:** the product becomes prescriptive in response to resistance. "You should do X" produces churn.

**Failure modes:**
- The product retreats and softens its claims under user resistance. Loses credibility.
- The product escalates and pushes harder. Loses the user.
- The user's challenge exposes a real product limitation (bad inference, missed pattern). Trust damaged.

### Month 4–6: dependency vs. instrument distinction

By month 4, two paths diverge:

- **Healthy path:** the product is integrated as instrument. The user opens it during specific moments (Sunday, pre-event, post-event). Tenure is long; depth is appropriate.
- **Unhealthy path:** the user has begun using the product for emotional regulation rather than observation. Opens it too often. Reads patterns repeatedly. May be using AI reflections as substitute for human connection. **This is the parasocial-drift risk** (Isolated Visionary archetype).

**The product must detect the unhealthy path and reduce, not amplify.** Detection signals:
- Multiple daily opens with no captures.
- Re-reading the same patterns repeatedly.
- Long engaged sessions (>10 minutes regularly).
- Capture content trending toward AI-companion framing.

**Intervention:** soften proactive surfacing; suggest stepping back ("you've been checking in often this week; the product also works if you only check in once a week"); never punish; never moralize.

### Month 6: the moat begins to bind

**Emotional state:** for users still engaged at month 6, the product has become close to irreplaceable. Their data substrate is rich enough that the product produces insights no competitor can replicate.

**Cognitive state:** the product is integrated into operating rhythm.

**This is when the moat (Turn 1 §15.1) begins to bind.** Switching cost rises monotonically from this point.

**Risk:** **complacency.** The product team can over-rely on the data moat and reduce investment in ongoing insight quality. This is how good products start to feel stale. The moat protects against new entrants; it does not protect against the user's own boredom.

---

## 5. Why Users Open the App

Synthesized across journey shapes:

1. **Acute distress requiring orientation** (11pm dread check, post-bad-decision, crash recovery). The user is looking for footing. Use cases 1, 3, 5.
2. **Ritual integration** (Sunday review, morning intent set). The user has incorporated the product into their week. Use cases 2, 8.
3. **Anticipatory grounding** (pre-event). The user wants calibration before high-stakes action. Use case 4.
4. **Investigative curiosity** (is-this-normal, off-day investigation). The user has noticed something and wants to look. Use cases 6, 9.
5. **Connection/normalization** (am-I-the-only-one). The user feels alone with the load shape. Use case 7.
6. **Handoff** (therapist export). The user is taking adaptive action. Use case 10.

**The two highest-frequency triggers are #1 and #2.** The Sunday synthesis is the most reliable ritual trigger; the late-night activation moment is the most reliable acute trigger.

## 6. Why Users Stop Using the App

Synthesized:

1. **Cold-start brittleness.** Product can't carry weight in week 1; user leaves before substrate accumulates.
2. **Generic content.** AI synthesis indistinguishable from the user's own thinking. No edge.
3. **Wrong inference.** A confident AI claim that's wrong. Trust permanently damaged.
4. **Wellness drift.** Tone, copy, or visuals start to read as a wellness app. Identity-protective uninstall.
5. **Demand creep.** The product asks for more attention than it earns. Resentment.
6. **Reflection fatigue.** Continuous self-observation exhausts the user. Especially in Recovery-Resistant and Suppression-Driven archetypes.
7. **Rumination induction.** Adverse-effect realized. Some users will need to leave.
8. **Life context change.** New job, exit, parental leave, end of a venture. Sometimes the user *should* leave. Re-onboarding must remain possible.
9. **Identity-attack misread.** User reads patterns as venture-state signals; panics; leaves.
10. **Privacy concern.** Real or perceived. A single news story about an AI mental health product breach can cost us a non-trivial fraction of users.

**Mitigation priorities (highest impact):**
- Cold-start design (mitigates #1).
- ML evaluation infrastructure (mitigates #3).
- Style guide enforcement (mitigates #4).
- Demand-reduction logic (mitigates #5, #6).
- Rumination detection (mitigates #7).
- Privacy architecture (mitigates #10).

## 7. Trust-Building Moments

Specific, repeatable design opportunities:

1. **Day 7: first weekly synthesis.** Must contain at least one non-obvious source-linked observation.
2. **Day 14–21: first cross-week pattern.** "This is the second week in a row X has appeared."
3. **Day 21–30: first wearable-narrative connection.** "Your HRV dipped on the days you reported X."
4. **Month 2: first cross-month pattern.** The single most powerful retention moment.
5. **The first time the product correctly anticipates that the user will resist a finding.** "You may want to dismiss this; here's the data anyway."
6. **The first time the product surfaces a wrong claim and the user can correct it cleanly.** Correctability is a trust accelerator if friction is low.
7. **The first therapist export.** Demonstrates the product is not trying to keep the user.
8. **The first time the product reduces its own demand.** "You've checked in often this week; consider taking a break." Counterintuitive trust win.

## 8. Judgment-Triggering Moments

Specific, avoidable design failures:

1. **Emotion-naming UI elements.** Any tab labeled with a feeling word.
2. **Population-comparison surfaces.** "You're below average for ___."
3. **Soft-language AI tone.** "It sounds like you might be feeling overwhelmed."
4. **Performance-review framing.** Any layout that resembles a 1:1 dashboard or KPI tracker.
5. **Score-based feedback.** "Your wellbeing score this week is 67."
6. **Streak loss notifications.** "Don't lose your streak!"
7. **Re-engagement copy after absence.** "We miss you!" Inviolably wrong.
8. **Encouragement copy.** "You've got this!" Disqualifying.
9. **Diagnostic-adjacent labels.** "Signs of burnout," "anxiety patterns," "depression indicators."
10. **Comparison to "healthy" baselines.** "Most people sleep 8 hours; you average 6." Out of scope. Implicitly judgmental.

Style guide must enforce these. They are not opinion; they are derived from this cohort's known triggers.

## 9. Reflection Fatigue Points

Predictable moments where users will hit fatigue:

1. **Week 3 of consecutive daily check-ins.** Novelty exhausted; depth not yet earned.
2. **Day 4–5 of a high-load week.** Already overloaded; another check-in is one too many.
3. **The day after a crash.** Capture is hard; reflection is harder; product must reduce demand.
4. **Month 3 plateau.** The product's surfacings start to feel familiar; the user wonders if there's anything new.
5. **Any week with major external negative event** (fundraise rejection, key departure, public failure). The user does not have capacity for reflection in this week. Reduce demand.

**Detection:** skipped captures, shortened sessions, declining response depth, longer latency between opens. **Response:** reduce demand, soften surfacing, never escalate. Never send "we noticed you haven't checked in" messages.

## 10. The Insight Moments

Where the product earns its existence:

1. **The "it noticed before I did" moment.** A pattern surfaced that the user had not consciously registered. This is the qualitative thesis-validation signal (Turn 1 §18).
2. **The "I am not crazy" moment.** A pattern surfacing that confirms the user's intuition about their own state, with data.
3. **The "this is the third time" moment.** A cross-cycle pattern that contextualizes a current state within a history.
4. **The "this changed when X changed" moment.** A causal-adjacent observation linking behavior to state.
5. **The "I was running depleted when I made that call" moment.** The retrospective debrief use case fulfilled.
6. **The "I should talk to someone" moment.** The product successfully prompts adaptive external action without prescribing it.

These are the artifacts the product is designed to produce. **All other features are scaffolding around these.**

---

## Risks across journey shapes

1. **Cold-start risk** is the highest-impact failure mode. Most retention is lost in week 1.
2. **Wrong-inference risk** is the highest-stakes per-event failure mode. Single events end relationships.
3. **Parasocial-drift risk** is highest in Isolated Visionary archetype around month 3–5. Detection and intervention required.
4. **Reflection-fatigue risk** rises monotonically with use. Demand-reduction logic required.
5. **Identity-attack-misread risk** is constant; design must guard structurally.

## Open questions

1. What is the right cadence for proactive surfacing? Currently leaning toward weekly only (Sunday synthesis), with everything else user-initiated. Validate vs. alternative cadences.
2. How do we detect parasocial drift early enough to intervene meaningfully?
3. Is week 3 the right intervention point for reflection-fatigue mitigation, or earlier?
4. What signals best predict imminent churn at month 3–4? Hypothesized: declining session length + missed weekly synthesis + biosignal volatility. Needs measurement.
5. Should the product offer a deliberate "off month" — explicitly pause and resume — to manage long-term fatigue? Could be brand-positive and retention-positive simultaneously. Worth testing.
