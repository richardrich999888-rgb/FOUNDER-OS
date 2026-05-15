# Behavioral Archetypes — Ballast ICP

**Status:** working document. These are *behavioral archetypes*, not marketing personas. No demographic filler. No fake names. The archetypes describe **operating modes** under sustained load, not personality types. A single user can drift between archetypes over time; archetype is partly state, partly disposition.

**Purpose:**

- Inform ML retrieval, prompt design, and reflection generation (the AI must behave differently for different archetypes).
- Inform onboarding flow (different archetypes need different first-week experiences).
- Inform retention and churn models (different archetypes churn for different reasons).
- Inform feature prioritization (some features serve some archetypes, not all).

**These archetypes are not shown to the user.** Identity-labeling this cohort would destroy trust (see founder-psychology-research §10).

**Source basis:** synthesis of the founder-psychology-research, burnout-research-notes, and behavioral-science documents. Where archetypes derive from specific clinical constructs, the construct is cited. Where they are observational syntheses, that is flagged.

---

## Archetype taxonomy

Six primary archetypes, organized along two axes:

- **Axis 1 — relationship with internal state:** suppression-oriented ←→ over-attentive
- **Axis 2 — relationship with action:** compulsively active ←→ paralyzed

```
                       OVER-ATTENTIVE
                              │
        Isolated Visionary    │   Recovery-Resistant
        (high attention,      │   (high attention,
         paralyzed)           │   compulsive)
                              │
       PARALYZED ─────────────┼──────────────  COMPULSIVELY ACTIVE
                              │
        Suppression-Driven    │   Compulsive Executor
        (low attention,       │   (low attention,
         paralyzed in denial) │   compulsive)
                              │
                       SUPPRESSION-ORIENTED
```

Plus two transverse archetypes that cut across the grid: **Hyper-Rational Optimizer** and **Chaos-Adapted Founder**.

The grid is a working model, not a validated taxonomy. It is offered as design guidance, not as a clinical instrument.

---

## 1. The Suppression-Driven Operator

**Operating mode:** dominant short-term coping is emotional suppression (Gross 1998 paradigm). Functional, often successful in the first 12–24 months of a venture. Cost is cardiovascular and cognitive, accumulating invisibly.

**Cognitive patterns:**
- Externalizes problems as solvable; internalizes them as not-worth-discussing.
- Decision-making is fast and confident in the moment, often regretted later.
- Strong stimulus filtering: blocks out signals that don't relate to the immediate goal.
- Recovery is treated as a future-self problem.

**Emotional blind spots:**
- Cannot name current emotional state accurately. Will report "fine" while showing physiological activation.
- Underestimates accumulating fatigue.
- Misreads cynicism as realism (the Maslach depersonalization dimension, unrecognized).

**Relationship with self-observation:**
- Mild allergy. Tolerates instrumentation (data is acceptable), rejects reflection (talking about it is not).
- Will engage with biosignal trends but skip journal prompts.
- The "what does this tell me about myself" question is processed as a category error: *"I don't have time for that question."*

**Likely retention behavior:**
- High initial engagement with passive features (wearable, biosignal trend).
- Low engagement with active reflection.
- Returns to the product during anomalies (HRV crash, sleep crash) — uses it diagnostically, not habitually.
- Long retention if the product respects suppression; quick churn if the product asks too much, too soft.

**Likely churn behavior:**
- Churns when the product feels like therapy.
- Churns on any UI moment that reads as "feelings talk."
- Churns when AI reflections feel patronizing.
- Does NOT churn on absence of warmth — warmth itself is a signal of wrong-fit product.

**Resistance patterns:**
- Will skip journal entries indefinitely.
- Will dismiss AI observations as "yeah, I know."
- Will not enter into a chat dialogue.
- Will export and read data, but not respond to it.

**Trust formation:**
- Trust forms through *accuracy of mechanical observation*. The first time the product surfaces a pattern they didn't notice but is undeniably true on inspection, trust crystallizes.
- Trust dies on first wrong claim. One bad AI inference and the product becomes "not for me."
- Trust slowly accumulates from non-intrusion. The product that doesn't bother them earns standing.

**Product design implications:**
- Surface biosignal and behavioral patterns first; ask for journaling later, optionally.
- AI tone: terse, observational, factual, never invitational.
- Weekly reflection should be readable in under 3 minutes; depth is opt-in.
- No "how are you feeling" prompts. Replace with "what was the dominant load this week?"

**This is the modal MVP user.** Probably 35–50% of the ICP. The product must serve this archetype first; everything else is downstream.

---

## 2. The Hyper-Rational Optimizer

**Operating mode:** treats self as a system to be optimized. Self-quantification is comfortable; emotional vocabulary is uncomfortable. Reads research, runs experiments on themselves, uses cold-plunges and structured supplements, knows their HRV trends.

**Cognitive patterns:**
- High openness to information; low openness to emotional reframing.
- Will A/B test their own sleep, diet, supplements.
- Wants metrics; distrusts narrative.
- Suspicious of "soft" claims; demands citation and mechanism.

**Emotional blind spots:**
- Confuses self-quantification with self-knowledge. Knows their HRV; doesn't know what their cynicism level has been doing.
- Reduces complex internal state to single scalars (often misleadingly).
- May ignore non-quantifiable signals from partner, body, gut.

**Relationship with self-observation:**
- Strong appetite for data-driven self-observation.
- Rejects therapy-flavored self-observation.
- Will write structured logs if structured; not free-form journals.

**Likely retention behavior:**
- High engagement with biosignal trends, pattern surfaces, source-linked observations.
- Power-user of export, integrations, custom views.
- Highest LTV archetype if the product earns their respect.

**Likely churn behavior:**
- Churns on AI confidence overclaim. One unfounded inference = product is "vibes-based."
- Churns on missing data sources. Wants every wearable, calendar, communication signal integrated.
- Churns if visualization quality is poor.

**Resistance patterns:**
- Will challenge every AI claim if not source-linked.
- Will export to their own analysis tools and check our math.
- Will read terms of service and threaten to leave on privacy concerns.

**Trust formation:**
- Trust forms through *methodological rigor*. The product's evaluation work, confidence calibration, and source attribution must be visible.
- Trust forms through *transparency about uncertainty*. Will trust a product that says "I don't know" over one that always has an answer.
- Trust forms through *honest about limits*. Will respect "this is a 21-day pattern; insufficient depth for a strong claim."

**Product design implications:**
- Power-user surfaces are not optional for this archetype. Confidence bands, source citations, raw data export, methodology pages.
- Wearable integration breadth matters more than for other archetypes.
- AI tone: precise, calibrated, hedged where appropriate, no warm performance.
- This archetype is the loudest and the most enthusiastic when satisfied. Disproportionate referral driver. **Worth designing for explicitly even though it is not the modal archetype.**

Approximately 15–25% of the ICP. Outsized influence on the early evangelism flywheel.

---

## 3. The Compulsive Executor

**Operating mode:** running on action momentum. Cannot sit still. The pause that reflection requires feels like death. Productivity is identity.

**Cognitive patterns:**
- Confuses motion with progress.
- Cannot tolerate empty calendar.
- Treats rest as a defection from self.
- Decision quality degrades but they decide more.

**Emotional blind spots:**
- Cannot distinguish "energized" from "activated." Reads sympathetic activation as healthy intensity.
- Misses fatigue until it presents as anger or accident.
- Cannot identify what they actually want — only what they will do next.

**Relationship with self-observation:**
- Suspicious of any activity that requires sitting still.
- Will use the product for 30 seconds at a time, intensely.
- Cannot do weekly reflection of 10+ minutes without abandoning.

**Likely retention behavior:**
- Heavy daily check-in usage if it's truly under 30 seconds.
- Skips weekly reflection until forced (or until a crash).
- Spikes engagement after crashes; reverts to baseline minimal use afterward.
- Long retention with low intensity. Tenure high, depth low.

**Likely churn behavior:**
- Churns when the product asks for time they don't have.
- Churns when the AI surfaces patterns about resting.
- Churns when the product itself becomes a to-do item.

**Resistance patterns:**
- Will not do anything that takes more than a minute.
- Will not engage with content suggesting they slow down.
- Treats notifications as obligations and resents them.

**Trust formation:**
- Trust forms through *time-cost efficiency*. The product that takes 90 seconds and tells them something useful earns standing.
- Does not respond to depth or warmth. Responds to *signal density*.
- The "you crashed last quarter after this same pattern" delivered in a single sentence earns the relationship.

**Product design implications:**
- The 30-second check-in must actually be 30 seconds. Cap it.
- Voice journaling, if shipped, is disproportionately valuable here (during commute, between meetings).
- Weekly reflection must have a "TL;DR" surface that respects their time budget.
- AI tone: dense, direct, single-sentence patterns where possible.

Probably 20–30% of the ICP. High install volume, moderate retention, low depth.

---

## 4. The Isolated Visionary

**Operating mode:** runs a venture whose context no one else in their life understands. Partner, family, employees, peers — none have the full picture. Loneliness is structural, not emotional.

**Cognitive patterns:**
- Carries information no one else can validate or challenge.
- Develops a sealed internal world; external input cannot reach the load-bearing decisions.
- Either over-shares with the wrong audience (employees, social media) or under-shares with everyone.
- Decision quality suffers from absence of pressure-test.

**Emotional blind spots:**
- Treats loneliness as a fact of role, not a state to address.
- Underestimates how much cognitive load comes from carrying information alone.
- May misread the absence of feedback as the absence of problems.

**Relationship with self-observation:**
- Often the most introspective archetype already. Has thought about themselves a lot.
- But the introspection is *unwitnessed* — no external mirror, no feedback, no corrective input. Internal monologue without correction.
- The product is, for this archetype, the missing external mirror.

**Likely retention behavior:**
- Highest engagement with weekly reflection.
- Engages with AI observations as conversation partners — but careful: this is the archetype most at risk of parasocial drift if the AI has any character.
- Strong long-term retention if the product is genuinely useful and resists becoming a substitute for human connection.

**Likely churn behavior:**
- Churns when the product feels mechanical and they wanted a confidant. (This is acceptable — they are the wrong user.)
- Churns when AI reflections feel shallow. They have already thought through what we surface; we have to go deeper.
- Churns on parasocial guilt — using the AI to talk about partner-level intimacy and then feeling pathetic about it.

**Resistance patterns:**
- May try to make the AI into a friend. The product must refuse this gently and consistently.
- May over-share content that should be discussed with a person. The product must redirect, not absorb.

**Trust formation:**
- Trust forms through *being seen accurately by the system*. The pattern surface that says "you have been carrying X alone for Y weeks" is the breakthrough moment.
- Trust forms through *honest limits*. The product that says "this is a thing to talk to another human about" rather than absorbing it gains long-term trust.
- Trust collapses if the product tries to substitute for human relationship.

**Product design implications:**
- AI must explicitly refuse companion-role drift. "I'm not here to be a friend; I'm here to make patterns visible."
- Anonymous peer features (v2) will land disproportionately well here, if executed without dependency mechanics.
- Source-linked weekly reflection that respects their already-high self-awareness wins.
- Therapist-handoff export (Turn 1 §20.10) is a flagship feature for this archetype.

Probably 15–25% of the ICP. Highest depth of engagement; highest risk of misuse.

---

## 5. The Chaos-Adapted Founder

**Operating mode:** has been living in high-load mode so long that low-load mode is the unfamiliar state. Identifies with the chaos. Boredom is intolerable. Equilibrium is suspicious.

**Cognitive patterns:**
- Generates urgency where none exists.
- Allergic to calm; calm reads as "missing something."
- Often a serial founder or a long-term operator past the 24-month mark.
- High allostatic load (burnout-research §1.3) without subjective distress, because the elevated state has become the reference baseline.

**Emotional blind spots:**
- Cannot detect the absence of recovery. Has forgotten what recovered feels like.
- Reads partner concerns as overreaction.
- Will normalize biosignal patterns that are clinically concerning.

**Relationship with self-observation:**
- Mildly bored by it.
- Tolerates it when paired with concrete patterns about work decisions.
- Rejects it when it implies they should slow down.

**Likely retention behavior:**
- Moderate engagement. The product is one of many things in a high-input life.
- Returns during inflection moments (fundraise, exit, key hire, public crisis).
- Long tenure; uneven depth.

**Likely churn behavior:**
- Churns when life calms (which they engineer not to happen, but occasionally does).
- Churns when the product asks them to act on its observations and they're not interested.
- Churns when they sense a pattern of slow degradation and decide they don't want to see it.

**Resistance patterns:**
- Will rationalize anomalies.
- Will compare themselves to peers in worse states ("at least I'm not Jeff").
- Will defer until a crash; crash; restart at zero.

**Trust formation:**
- Trust forms through *not being moralized at*. The product that does not tell them to slow down, but shows them precisely what their current pace costs in measurable terms, wins.
- Trust forms over multiple cycles. They have to live through a crash and recover and see the pattern documented to take it seriously.

**Product design implications:**
- Long-arc retrospectives (90-day, 180-day, annual) land disproportionately well here. The single week is often invisible to them; the year is undeniable.
- AI must not moralize. "Here is what you reported six months ago when this pattern last occurred" wins; "you should slow down" loses.
- Pattern surface across cycles is the killer feature for this archetype.

Probably 10–20% of the ICP. Hardest to influence in-cycle; valuable to retain across cycles.

---

## 6. The Recovery-Resistant Operator

**Operating mode:** physically knows they need recovery; cannot do it. Identity-protective against rest. Guilt-active around any visible decompression. Distinct from the Compulsive Executor: this archetype *knows* they need rest and is *unable* to take it, whereas the Compulsive Executor doesn't accept the need.

**Cognitive patterns:**
- Cognitive dissonance between what they know is true and what they do.
- Reads rest as moral failure.
- May have had a prior breakdown or crash event that they survived; behaviorally, did not update.

**Emotional blind spots:**
- Doesn't see how the guilt itself is the load. "I tried to rest yesterday and felt awful" is read as evidence rest doesn't work, not as evidence the guilt response needs work.
- May confuse rest with stagnation.

**Relationship with self-observation:**
- Welcomes data. Often the most enthusiastic instrument-adopter.
- But the data does not change behavior, which can produce a secondary discouragement layer.

**Likely retention behavior:**
- High engagement, especially with biosignal and recovery data.
- High weekly-reflection engagement.
- Strong tenure, slowly accumulating cost-of-doing-nothing-about-the-data signal.

**Likely churn behavior:**
- Churns when the data becomes a constant reminder of what they aren't doing. The product becomes a guilt machine.
- Churns when AI observations feel like nagging.
- Churns into another tool or shifts to denial when the gap between data and behavior becomes unbearable.

**Resistance patterns:**
- Will negotiate with the data. "But I also did X."
- Will request more features rather than act on existing ones.
- May ask for AI to be more directive (which would be a regulatory boundary violation — see Turn 1 §12).

**Trust formation:**
- Trust forms through *non-judgmental persistence*. The product that keeps presenting the pattern without escalating language wins.
- Trust forms through *small-step framing*. The product that occasionally surfaces "the smallest thing that would matter this week" is useful without being prescriptive.

**Product design implications:**
- Avoid framing recovery patterns as recommendations.
- Highlight the *cost* the user is already paying, not the *behavior* they "should" change.
- AI tone: persistent, non-escalating, never repetitive in the same week, never identical phrasing twice in a row.
- This archetype is the most at risk for adverse rumination from over-observation. Detection layer (behavioral-science §1.3) most important here.

Probably 10–15% of the ICP. Long retention if managed; serious adverse-effect risk if not.

---

## Archetype distribution (working estimate, to be measured)

| Archetype | Estimated share | Notes |
|---|---|---|
| Suppression-Driven | 35–50% | Modal; product designed for this first |
| Compulsive Executor | 20–30% | High volume, low depth |
| Hyper-Rational Optimizer | 15–25% | Disproportionate evangelism |
| Isolated Visionary | 15–25% | Highest depth, parasocial risk |
| Chaos-Adapted | 10–20% | Long-arc retention required |
| Recovery-Resistant | 10–15% | Adverse-effect risk |

Percentages overlap because users drift between archetypes. **This taxonomy is a working hypothesis, not a measurement.** Validation requires either (a) embedded archetype classifier in onboarding using research-validated short-form instruments, or (b) cohort interviews at scale. Recommend (a) for production, (b) for early product cycles.

---

## Cross-archetype design constraints

Even though the archetypes differ, several design constraints apply across all of them:

1. **No archetype labels visible to the user.** Identity-labeling destroys trust for all six.
2. **No moralizing AI voice.** Loses every archetype.
3. **Source-linked claims.** Mandatory for trust formation in all six, for different reasons.
4. **Bounded reflection.** Pennebaker-style dose, not continuous demand. Applies to all.
5. **Easy off-ramp.** Frictionless pause or exit. Applies to all.
6. **Visible time cost.** "This will take 30 seconds." Applies especially to Compulsive Executor; non-aversive to all.

## Onboarding implications

The onboarding flow must implicitly classify the user and adapt — without exposing the classification.

**Day 1:** all archetypes get the same minimal capture (30-second check-in, wearable connect, baseline).
**Day 7:** first weekly synthesis. Tone, depth, and emphasis vary by archetype.
**Day 14:** the first AI-surfaced pattern. Calibration of confidence and framing varies by archetype.
**Day 21:** archetype-aware engagement decision. For Suppression-Driven and Compulsive Executor, reduce frequency. For Hyper-Rational and Isolated Visionary, deepen surface area.

Implementation requires lightweight archetype inference from first-week behavior. **Recommend implementing as a probability distribution over archetypes, not a hard classification.** Mostly-suppression-driven-with-some-recovery-resistant is a real and common operating state.

## Risks

1. **Archetype mis-classification leading to wrong product behavior.** Hard hard mode for ML.
2. **User drift between archetypes faster than the product re-classifies.** A founder under acute stress can move from Hyper-Rational to Recovery-Resistant in a quarter. The system must track this.
3. **Selection bias in early cohorts.** First users will skew Hyper-Rational (they're the most enthusiastic about instrumentation). The product can become tuned for them and lose the modal Suppression-Driven user. **Active risk to watch in MVP.**

## Open questions

1. Are these six archetypes empirically separable in our cohort, or do they collapse into fewer? Run cluster analysis on early user behavior.
2. What is the minimum behavioral signal we need to infer probable archetype? Hypothesized: 5–7 days of capture + wearable.
3. What is the right ML architecture for archetype inference? Likely a small classifier on user-level features (interaction patterns, response latencies, voice/text choices, biosignal volatility). Not a clinical instrument.
4. How do we handle archetype drift across months? Probabilistic update or re-classification?
5. Should certain archetypes be screened out at onboarding entirely (e.g., user appears in acute clinical distress)? Probably yes; needs careful triage architecture.
