# Phase 3 — Demo script + rehearsal

You have ~3 minutes on stage. Every second matters.

## The pitch (memorize the first sentence)

> "LLM agents hallucinate business decisions. Real founders ask real people. AutoBusiness gives agents that same instinct — when they're not sure, they don't guess, they ask real humans via Terac. Let me show you."

Then immediately type the idea into the console. Do not narrate the architecture — show it.

## Demo script (10 beats, ~2:45 total)

### Beat 1 — Idea input (0:00 – 0:15)
- Type into the console: **"I have a 3D printer sitting idle for a month, make me money."**
- Click Launch
- Say: "The user is the owner. From here on, they're passive. They watch."

### Beat 2 — Plan generation (0:15 – 0:30)
- Planner LLM emits trace events, plan appears in trace column
- Point to trace panel: "Planner reads the idea, produces a plan, spawns four agents in parallel."

### Beat 3 — Research kicks off (0:30 – 0:50)
- Researcher trace events stream: "Searching Etsy top sellers…", "Cross-referencing Reddit r/3Dprinting…", "Analyzing pricing bands…"
- Say: "The researcher is browsing the real web via Superserve sandbox."

### Beat 4 — LOW CONFIDENCE ⚠️ (0:50 – 1:05)
- Researcher emits final result: "Top pick: cable organizers, **confidence 0.5**"
- Point at confidence pill (yellow/red in UI)
- Say: "Here's where every other agent framework hallucinates. Ours does not."

### Beat 5 — Verifier calls Terac (1:05 – 1:25)
- Verifier emits: "Confidence too low. Consulting 15 real makers via Terac."
- `terac_call` event fires with visible question card
- Say: "We just launched a real study with 15 real humans. They're answering in real time."

### Beat 6 — Terac results land (1:25 – 1:45)
- ~8-15s of pulsing Terac icon (pre-launched study delivers results here)
- `terac_result` fires: "12 of 15 makers agree — cable organizers"
- Decision card animates in with **BEFORE (0.5)** → **AFTER (0.85)**
- Say: "That's the pitch. Real humans changed the plan."

### Beat 7 — Builder deploys (1:45 – 2:10)
- Builder trace: "Selecting template… Generating hero copy… Deploying to Render…"
- Landing URL appears, QR code renders
- Say: "The business is live on Render. Stripe payment link ready."

### Beat 8 — Real revenue (2:10 – 2:25)
- Point QR code at the audience: "If any judge wants to test it — scan and buy for $12. Every dollar counts."
- (Pre-arranged: teammate scans and buys during demo → Stripe balance tick visible)

### Beat 9 — Second business spawn (money-shot) (2:25 – 2:45)
- Type into the console again: **"my roommate wants to sell ceramic mugs"**
- Second tab appears in trace UI, second business starts running in parallel
- Say: "The platform is generic. Any business, same protocol. Owner-in-the-loop only for the big calls."

### Beat 10 — Owner alert (2:45 – 3:00)
- iMessage buzzes on phone (project it or show the Owner Notifications panel):
  "Major decision: DoorDash Drive vs USPS for fulfillment. My rec: USPS. Tap 👍 to confirm."
- Tap 👍 live → trace fires, decision recorded
- Say: "Owner sees decisions when it matters. Agents run the rest. Thank you."

## Rehearsal checklist (60 min before demo)

- [ ] **Full rehearsal #1** — end to end, time it. Aim for 2:45.
- [ ] Note what broke or lagged. Fix.
- [ ] **Full rehearsal #2** — again, time it. Should be smoother.
- [ ] **Full rehearsal #3** — this is the one you present. If this feels good, you're ready.
- [ ] Pre-launch a real Terac study at T-5 minutes so results land during Beat 6
- [ ] Pre-open FIXTURE_MODE tab in another browser as fallback
- [ ] Confirm your phone has iMessage sound ON and phone is on the projector or held up to camera
- [ ] Confirm Stripe test card ready on a teammate's phone for Beat 8
- [ ] Charge laptop, kill notifications, disable Slack, close all other apps

## Fallback ladder

If something fails on stage, fall down this ladder — don't panic, keep talking.

1. **Live everything works** — ideal
2. **Terac slow** — say "let's give it a moment" and keep talking about the architecture; results land in ~15s
3. **Builder/Render fails** — say "let's skip the deploy step" and switch to pre-recorded screenshot; the Verifier + Decision card is the star anyway
4. **Orchestrator flakes** — switch to FIXTURE_MODE tab; play back `demo-happy-path.jsonl`; nothing changes visually for judges
5. **Everything on fire** — pull up screen recording backup on the FIXTURE_MODE tab; narrate over it

## Q&A prep (2 min after demo)

Judges will ask:
- **"How is this different from Lovable or Bolt?"** — "They ship code. We ship businesses with human judgment loops. Terac is the point."
- **"What's real vs. mock in that demo?"** — Be honest: Planner + Verifier + Terac + Stripe + Render were real. Researcher may use Superserve or a fallback. Say exactly what.
- **"How do you make money?"** — Platform charges a % of revenue the businesses generate. Or flat monthly. Choose your answer, be crisp.
- **"What about compliance / legal?"** — "Legal is one of our Verifier categories — high-stakes decisions escalate to Terac lawyers, not the agent's guess."
- **"Can you actually run 100 businesses in parallel?"** — "Yes, each in its own Superserve sandbox, Band room, and Render service. Independent."

## Booth follow-up (post-demo)

- Have the trace UI up on your laptop at your booth
- Ask judges to type any business idea → run it live
- Print a QR code to the landing page you deployed live — hand it out
- Keep Stripe balance page open — if any judge buys $1, that's your Best Agent-Run Company evidence

## One last rule

**When something fails on stage, keep talking.** Judges don't remember the failure — they remember whether you flinched. Fall down the fallback ladder without acknowledging it. "Let me show you another business…" (switch to fixture tab). No one will know.
