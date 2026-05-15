# Emotional Use Cases — Mechanism, AI Behavior, UX Requirements, Failure Modes

**Status:** working document. Extends Turn 1 §10 with research-grounded mechanisms. Each use case is mapped to: the *psychological mechanism* that brings the user to the app, the AI behavior required, the UX requirements, and the way the use case can fail.

**Purpose:** translate emotional reality into product requirements without resorting to motivational or wellness framing.

**Reading note:** these are not "personas opening the app." They are operating states. Any single user can occupy any of these states at different times. Some users will live mostly in one (the Compulsive Executor in #4; the Isolated Visionary in #7). The product must serve the state, not the user identity.

---

## Use Case 1 — The 11pm Dread Check

**The moment:** User is wound up, can't settle, knows something is off, doesn't know what. Often Sunday-Monday transition, often mid-week post-conflict, often during fundraise weeks. The autonomic state is elevated (sympathetic dominance); the cognitive state is fragmented; the dominant feeling is unspecified unease.

**Psychological mechanism:**
- Allostatic activation persisting past stimulus removal (McEwen).
- Prefrontal capacity degraded; meta-awareness compromised (Arnsten; burnout-research §1.6).
- User can sense disregulation but cannot identify its source.
- Suppression strategy is failing in the moment because there is no task to channel the activation into.

**What the user actually wants:**
A mirror that lets them see what they've been carrying without making them name it. They want the cost made visible, not the feeling discussed.

**AI behavior required:**
- Surface the last 14 days of accumulating signal: sleep deficit, HRV trend, recurring narrative themes from check-ins.
- Anchor patterns to behavior, not emotion ("you mentioned X four times this week and slept under 6 hours on each of those nights").
- Do not ask "how do you feel."
- Do not offer breathing exercises, guided meditations, or grounding scripts. These are wellness-app moves and they alienate this cohort.
- Confidence calibration: visible. The AI says how much data the pattern is based on.

**UX requirements:**
- One screen. No navigation. No menu.
- Cached pre-rendered: latency must be near-zero. A 3-second load at 11pm produces drop-off.
- Dark-mode default for night use, but neutral (not "calming"). No animation, no breathing-orb visuals.
- A single "open this in the morning" action that defers deeper exploration to a higher-capacity state.

**Failure modes:**
- AI surfaces something alarming without context. User spirals.
- AI surfaces nothing because data is too thin. User concludes product is useless and uninstalls.
- The mirror reads as a business dashboard; user re-encodes patterns as venture-state and panics more (identity-fusion failure mode, founder-psychology §4.2).
- The product asks the user to capture instead of presenting. User cannot capture in this state.

**Cohort weight:** very high. This is one of the two highest-value emotional use cases for retention. If the product fails here, the user stops opening it during the moments that matter most.

---

## Use Case 2 — The Sunday Evening Review

**The moment:** User has space (maybe). Wants to look back at the week before the next one begins. Either ritualistic (the planner-types do this anyway) or anticipatory (the fundraise / launch week looming).

**Psychological mechanism:**
- Volitional reflection in a moment of relatively higher resource (Pennebaker / Di Stefano dose-effectiveness range).
- The user has capacity here; the product can ask for slightly more.
- This is the use case the behavioral-science literature most strongly supports as effective.

**What the user actually wants:**
A synthesis of the week that they could not produce themselves in the time available. Specifically: themes, deltas vs prior weeks, patterns that crossed the week's boundary.

**AI behavior required:**
- Weekly synthesis: produced asynchronously by Sunday morning, available on Sunday evening.
- Sources cited at sentence level.
- Three to five surfaced themes; no more (cognitive cost cap).
- Bias toward observation, not advice.
- Distinguish stable themes from new ones ("this is the fourth week in a row X has appeared" vs "this is new this week").
- Include biosignal context where relevant; not for its own sake.

**UX requirements:**
- One scrollable page; no tabs.
- 3-minute readable; depth on tap.
- Save / star / archive for the user to keep an item across weeks.
- Comparison to prior week available but not pushed.

**Failure modes:**
- Synthesis is generic. The user could have written it themselves. Trust eroded.
- Synthesis mis-cites or over-claims a pattern. Trust dies in a single error.
- The review is too long; user skims; insights bounce.
- The review is too short; feels lazy; user concludes the AI isn't really paying attention.
- The review reads as a manager's performance review. Identity-attack failure mode.

**Cohort weight:** the highest single-use-case retention driver. The Sunday synthesis is the product's primary value artifact. **Disproportionate engineering and ML investment justified.**

---

## Use Case 3 — The Post-Bad-Decision Debrief

**The moment:** User just made a decision they regret. Termination, hiring choice, pricing call, email sent in anger, deal turned down or accepted. The decision may not be reversible. The cognitive content is mostly self-attack.

**Psychological mechanism:**
- Acute negative affect, often paired with rumination onset (Lyubomirsky pattern).
- Hyper-responsibility activated (Salkovskis).
- Identity fusion produces "this decision means I am a bad founder/operator."
- Cognitive load spike; metacognition still partially intact for short window.

**What the user actually wants:**
To capture context — what state they were in, what they were optimizing for, what they were tired of — *for later review*. They are not, in this moment, ready for synthesis. They want a structured way to mark the event without performing okay-ness.

**AI behavior required:**
- Accept brief structured input: what happened, current state, what was the load.
- Do not synthesize in the moment. Do not reframe. Do not offer comfort.
- Bookmark the entry for pattern surfacing later.
- Optionally, surface adjacent past entries: "you made a similar capture two months ago after [event]." Carefully framed — pattern observation, not "you keep doing this."

**UX requirements:**
- A "something happened" capture flow, accessible in under three taps from any state.
- Structured prompts (state, load, what happened, anything else) — bounded; under 60 seconds.
- Voice capture as a first-class option here; user may be too activated to type.
- Save and exit; no synthesis required.

**Failure modes:**
- AI tries to reframe. User feels patronized and never captures another regret.
- Voice transcription fails or is laggy. User loses the moment.
- The capture flow is too long. User abandons before completing.
- The product attempts to interpret in real time. The user is not ready.

**Cohort weight:** medium for frequency, very high for retention impact. A captured regret reviewed three months later is the kind of insight that makes the product irreplaceable. But rare per user.

---

## Use Case 4 — The Pre-High-Stakes-Event Grounding

**The moment:** Board meeting, fundraise pitch, hard conversation, termination, key hire, public talk — in 5 to 60 minutes. User wants a fast read on their current state and what tends to happen when they decide from this state.

**Psychological mechanism:**
- Acute sympathetic activation that may or may not be problematic.
- Some level of activation is performance-optimal (Yerkes-Dodson, though that specific construct is dated; the underlying inverted-U exists).
- The user wants calibration, not calming. They are not trying to drop into parasympathetic recovery; they are trying to know whether their activation is on the right side of the curve.

**What the user actually wants:**
A 30-second read of their current state in personal context. "Your HRV is in your typical pre-board range. The last three times you went into board with this signal, you reported the meeting went well." Or: "Your sleep deficit is at three nights; in similar prior states, you reported your decisions skewed defensive."

**AI behavior required:**
- One screen. 30 seconds of reading max.
- Personal historical reference. This use case is meaningless without the user's own data substrate.
- No advice. The user is about to act; they don't want a pause; they want a calibration.
- No medical-style framing.

**UX requirements:**
- "Before something" mode, surfaced when user has a calendar event marked as significant (manually or by integration).
- One-card output.
- Voice readable (driving to event, walking in).
- Snapshot the current state for later — the user will want to compare post-event to pre-event later.

**Failure modes:**
- Cold-start: user has no historical data substrate. Output is generic. **This is the strongest argument for gating this feature until 30+ days of data, or for explicitly labeling it as "improving as we learn your patterns."**
- AI calms when calibration is what's wanted. Tonally wrong.
- AI predicts ("you will likely make a bad decision"). Regulatory violation, trust violation.

**Cohort weight:** moderate for frequency, very high for word-of-mouth. This is one of the use cases that produces "it noticed something before I did" testimonials — the qualitative thesis-validation signal from Turn 1 §18.

---

## Use Case 5 — The Crash Recovery

**The moment:** User visibly crashed. Slept 14 hours, missed a day, blew up at someone, didn't show up to a thing, drank too much, went silent. The crash may have been a single event or a 3-day collapse.

**Psychological mechanism:**
- Allostatic threshold crossed.
- The body and CNS have forced a recovery the user would not have chosen.
- Cognitive availability returning gradually; meta-awareness re-emerging.
- High shame load; risk of rumination onset.

**What the user actually wants:**
A structured way to register what happened without performing "I'm fine." Plus pattern context: "this is the third time in 6 months that this pattern has preceded a crash." They want to see they are not crazy and that this has shape.

**AI behavior required:**
- Soft entry: do not require detailed input. Accept "I crashed" as the entire input.
- Surface immediately: the precursor pattern from the last N days.
- Surface historically: prior crash markers if they exist.
- Do not analyze. Do not advise. Show the pattern, mark the event.
- If rumination signals (escalating negative self-content, looping language) appear, shift to grounding and source-citation, not deeper exploration.

**UX requirements:**
- An explicit "rough day / rough week" mode that the user can flag.
- Reduced surface area when this mode is on. No notifications. No proactive prompts. Lower visual stimulation.
- Easy access to pattern history. The user wants context, not new content.
- Crisis resources surfaced unconditionally (Turn 1 §12 protocol).

**Failure modes:**
- The product asks too many questions. User abandons.
- The AI labels ("you are burned out"). Regulatory boundary breach; identity attack.
- The product cheerleads ("you'll bounce back!"). User uninstalls and tells peers.
- The product fails to detect rumination and surfaces more reflective content. Adverse-effect risk realized.
- The product surfaces patterns that read as accusation ("you've been pushing too hard"). Recovery-Resistant archetype churns.

**Cohort weight:** moderate frequency, very high stakes per occurrence. The product's handling of this moment is the single largest determinant of long-term trust and retention.

---

## Use Case 6 — The "Is This Normal" Check

**The moment:** User had an unusual reaction to something — a stronger anger response than expected, a tearing-up at something small, a flat-affect response to a win, sustained inability to enjoy something they used to enjoy. They want to know if this is consistent with their own patterns or is a new signal.

**Psychological mechanism:**
- The user is partially noticing an internal-state shift but lacks reference.
- This is *adaptive* metacognition emerging through a small gap in suppression. Should be respected and supported, not exploited.

**What the user actually wants:**
Longitudinal comparison to themselves. "Has this happened before? When?" They specifically *do not* want population comparison. They are not asking "is this normal for people"; they are asking "is this normal for me."

**AI behavior required:**
- Personal-baseline only.
- Surface adjacent past entries when relevant.
- Do not interpret meaning. Surface the pattern; let the user interpret.
- Honest "I don't have enough data" when applicable. This is the use case where dishonesty about data depth most damages trust.

**UX requirements:**
- A search-the-past surface (this is the "search-your-own-mind" feature from Turn 1 §20.6).
- Filterable by content theme, time range, biosignal.
- **Gated by minimum data depth.** Below 21–30 days, this feature provides poor results and damages perception. Recommend gating with an honest message: "this works better the more you've used the product; currently I have N days of your data."

**Failure modes:**
- Cold-start failure. Most likely failure for this feature in MVP. **Gate it.**
- Search returns generic results. Trust damaged.
- AI interprets meaning the user didn't ask for. Patronizing.
- The "is this normal" framing implicitly invokes population comparison; AI should redirect to personal reference.

**Cohort weight:** moderate frequency. High value when it works. Cold-start risk high. **Gating recommended over inclusion in week-one experience.**

---

## Use Case 7 — The "Am I The Only One" Reach

**The moment:** User feels isolated. The structural loneliness of the role becomes acute. Wants confirmation, anonymously, that others are dealing with the same load shape.

**Psychological mechanism:**
- Structural loneliness in the founder role (founder-psychology §1.6).
- Acute moment may be triggered by external comparison (a peer's announcement, a partner's misunderstanding, a board member's pressure).
- The need is *normalization*, not commiseration. The user wants to know the load shape exists in others — not to bond about it.

**What the user actually wants:**
Anonymous, low-friction confirmation that others in their cohort are experiencing similar patterns. Not a group chat, forum, or public profile. They want a statistical mirror, not a community.

**AI behavior required (v2):**
- Aggregate, anonymized pattern surfacing across the user base. "Operators with your weekly pattern shape often report X." Carefully phrased, carefully aggregated, minimum cohort sizes.
- Never identifiable. Never named.
- Honest about sample size and limitations.

**UX requirements (v2):**
- Optional. Off by default.
- Read-only — no interaction with peers.
- Privacy-architectural enforcement: aggregation happens in a way that no individual user's data can be inferred.

**Failure modes:**
- Re-identification risk if cohort sizes too small. Privacy disaster.
- Comparison framing makes the user feel worse. Wellness-app antipattern.
- The aggregation creates a "you're below average" feeling. Toxic for this cohort.
- Feature deferred to v2 in Turn 1; **confirmed deferral after this analysis.** Build the core experience first.

**Cohort weight:** moderate, but the highest-leverage feature for the Isolated Visionary archetype when done right. Worth investing in for v2.

---

## Use Case 8 — The Morning Intent Set

**The moment:** Start of day. The user wants to register intent or signal state in under 30 seconds. May be at the coffee machine, in the car, on the way to a meeting.

**Psychological mechanism:**
- Light implementation-intention formation (Gollwitzer): a brief act of "today I am going to X" measurably increases follow-through, particularly under high cognitive load.
- This is the only well-evidenced "morning ritual" effect; everything else is mostly category lore.

**What the user actually wants:**
30 seconds. Maybe less. A capture that does not feel like journaling. Either a state read or an intent set. Not both. Not a list of three things, not a gratitude practice, not a body scan.

**AI behavior required:**
- Lightweight capture; minimal processing in the moment.
- Surface back at end of day or end of week — "you set X intent on Tuesday; what happened with that?"
- Never moralize about missed intent. Surface the pattern across weeks: "your follow-through is X% on intent-set days, Y% on non-set days." Or honest if pattern unclear: "no clear pattern yet."

**UX requirements:**
- Time-budgeted: visible "this takes 20 seconds" framing.
- Voice option.
- Cannot be the gate to anything else; if a user skips the morning capture, the rest of the product works fine.

**Failure modes:**
- Becomes a daily obligation that the user resents. (See Compulsive Executor archetype — sensitive here.)
- Creates streak guilt if mishandled (already excluded in Turn 1 §6).
- Skipping the morning capture should be invisible, not penalized. If skipping is observable to the user, the product has failed.

**Cohort weight:** high frequency, moderate per-use value, important for daily-active habit. The risk is making it feel obligatory. Design must keep it strictly optional.

---

## Use Case 9 — The Off-Day Investigation

**The moment:** User feels off and doesn't know why. Generalized lower mood, lower energy, edge of irritability. No identifiable cause. Wants the product to do detective work.

**Psychological mechanism:**
- A signal exists; the user's metacognition is intact enough to notice; not intact enough to source it.
- This is *exactly* the use case the product was designed for. The instrument-gap (Turn 1 §1.1) is open at this moment.

**What the user actually wants:**
A 72-hour rewind: what changed in sleep, biosignal, behavior, narrative content. The product to surface the candidate causes; the user to recognize which one resonates.

**AI behavior required:**
- Pull the last 72 hours of all signals.
- Surface up to three candidate factors, source-linked.
- Conservative confidence. "These are the things that changed; I'm not telling you which one is the cause."
- Refuse to single-cause.
- Always source-link.

**UX requirements:**
- A "something feels off" entry point.
- Investigation surface: a small dashboard of the last 72 hours, signals overlaid.
- User can mark "this is it" on a candidate factor — productive labeling that improves future inference.
- Save and exit cleanly.

**Failure modes:**
- Cold-start: not enough data to investigate. Honest message; no fake answer.
- Single-cause confidence: AI says "you didn't sleep" and the user knows it was something else. Trust damaged.
- Too many candidate factors: user can't process. Cap at three.
- AI suggests user investigate medical causes. Regulatory boundary risk. Avoid.

**Cohort weight:** medium frequency, very high per-use value. Each successful investigation produces a strong retention moment.

---

## Use Case 10 — The Therapist Handoff

**The moment:** User has been seeing patterns long enough that they want to bring them to a therapist or other professional. Or: the user is doing therapy and wants to share data with the therapist between sessions.

**Psychological mechanism:**
- Healthy escalation. The user is taking adaptive action.
- This is the use case where the product *deliberately reduces its own retention*. Doing so well is a long-term trust accelerator.

**What the user actually wants:**
A clean, comprehensive export of their own data in a format a clinician can read. Themes, patterns, biosignal trends, key entries, with timestamps.

**AI behavior required:**
- Generate a clinician-readable summary on request.
- Be honest about the product's role: instrumentation, not diagnostic.
- Suggest the therapist as the appropriate next layer; not compete with them.
- Re-onboard cleanly if the user returns from therapy later.

**UX requirements:**
- "Share with therapist" / "Export for clinician" first-class action.
- PDF or readable Markdown output.
- User controls scope (last N weeks, all data, specific themes).
- One-tap. No friction.

**Failure modes:**
- Export is incomplete or poorly formatted. Clinician can't use it.
- Export contains AI inferences as if they were findings. Misleads clinician.
- The "leaving for therapy" path produces a churn alert internally that prompts a retention campaign. **This must be explicitly excluded.** No retention surfacing on therapy-related signals. Turn 1 §13 trust principle confirmed.

**Cohort weight:** low frequency, very high signal value. This use case is itself a thesis-validation signal. If users use it, the product is doing its job.

---

## Cross-Cutting Constraints

Common across all ten use cases:

1. **No emotion-naming UI buckets.** Operator vocabulary throughout: load, signal, pattern, recovery, capture.
2. **No advice, ever.** All ten use cases involve a user who is more competent than the product to decide what to do. The product's job is to surface, not to recommend.
3. **Crisis content always present, always free, always accessible.** Use cases 1, 5, and 9 are highest-risk moments. Crisis resources unconditional.
4. **Bounded sessions.** Every use case has an explicit exit; nothing is endless.
5. **Latency under 2 seconds for entry surfaces.** Cognitive load arguments from burnout-research apply across all of these.
6. **Voice as first-class option for use cases 3, 5, 8, 9.** Decision to ship voice in MVP or defer is a separate engineering tradeoff (see Turn 1 audit, contradiction #4).

---

## Prioritization for MVP

If only five use cases ship in MVP, they should be:

1. **Use Case 2 (Sunday Evening Review)** — primary value artifact.
2. **Use Case 1 (11pm Dread Check)** — entry trigger for many users; defines the product feel.
3. **Use Case 5 (Crash Recovery)** — single highest stakes for trust.
4. **Use Case 8 (Morning Intent Set)** — daily-active surface.
5. **Use Case 10 (Therapist Handoff)** — trust and ethics flagship.

Use Cases 3, 4, 6, 7, 9 are higher-investment or higher-risk and should be sequenced into v1.1+ based on cohort behavior.

This list is more conservative than the Turn 1 §20 MVP feature list and should be reconciled with it explicitly in Turn 3 (UX).

## Risks across the use case set

1. **Cold-start brittleness.** Five of the ten use cases need 21+ days of data to be useful. The first three weeks of any new user's experience must be designed around the use cases that do not need depth (1, 5, 8 at minimum).
2. **Rumination induction.** Use Cases 1, 5, 6, 9 are high-risk for inducing rumination. Detection layer mandatory.
3. **Identity-attack misreads.** Use Cases 1, 2, 5 are high-risk for users reading personal patterns as venture signals. Visual separation mandatory.
4. **Wellness drift.** Designers and writers will, under pressure, soften the tone toward wellness language. Style guide enforcement mandatory.
5. **Power-user concentration.** Use Cases 4, 6, 9 will skew Hyper-Rational Optimizer adoption. The product can become tuned for that archetype and lose the modal Suppression-Driven user. Watch in cohort analysis.

## Open questions

1. Which use cases produce the highest 90-day retention contribution? Hypothesized 2 and 5; needs measurement.
2. Can Use Case 9 (off-day investigation) be made viable without external integrations (calendar, communication)? If yes, defer integrations. If no, integrations are critical.
3. What is the minimum data depth at which Use Case 6 (is-this-normal) produces a satisfactory user experience? Probably 30–45 days; needs validation.
4. Do users self-select into Use Case 7 (am-I-the-only-one) without dependency dynamics? Or does it create comparison-anxiety? Test before committing.
5. What is the right surfacing model for proactive vs reactive use cases? Currently 8 of 10 are reactive (user-triggered). Should any be proactively offered to the user, and at what cost to trust?
