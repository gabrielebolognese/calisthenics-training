# PLAN_SPEC: Calisthenics Strength Plan, extracted for the app

This is a structured extraction of `Calisthenics Strength Plan.pdf` (15 pages, dated 2026-10-15). Every number in `src/plan/` must trace back to a line in this file.

Tags:
- `(p.N)`: stated in the PDF on page N.
- `[B]`: comes from the app brief (`BRIEF.md`), not the PDF.
- `[Dnn]`: a gap I filled. See `DECISIONS.md`.

The PDF is the source of truth for training content. If this file and the PDF disagree, the PDF wins and this file is wrong.

---

## 1. Goals (p.1–2)

| id | Skill | Week 0 test | Target | Priority | Realistic by week 24 | App metric |
|---|---|---|---|---|---|---|
| `hspu` | HSPU | 11 reps (fatigued at 6) | 20 to 25 | Primary | 16 to 20 | clean reps, AMRAP |
| `pushup90` | 90 degree push-up | 2 clean (3rd at ~80°) | 5+ | Primary | 4 to 5 | clean reps, max |
| `archer` | Archer HSPU | 2 per side clean (3 with bent arm) | 4 per side clean | Primary | 3 to 4 per side | clean reps per side; the lower side is shown |
| `handstand` | Freestanding handstand | 55 s | 120 s | Primary | 90 to 120 s | seconds, max hold |
| `frontLever` | Front lever | 5 s (bad day) to 8 s (good day) | 20 to 30 s | Primary, long term | 12 to 15 s | seconds, max hold |
| `flag` | Human flag (monkey bars) | 4 s | 10 to 15 s | Primary | 8 to 12 s | seconds, max hold |
| `muscleUp` | Muscle-up | 7 reps | 20+ | Primary | 13 to 16 | clean reps, AMRAP |
| `ntMuscleUp` | No-transition muscle-up | not yet | 1 clean rep | Secondary | attempts start in Block 3 | unlocked yes/no, best attempt |
| `planche` | Planche | adv tuck, one-leg for a few seconds | full planche, a few clean seconds | Secondary | clean one-leg, straddle work started | current level + max hold per level |
| `abs` | Abs | visible, not sharp | thicker and sharper | Secondary | visibly sharper | qualitative; shows current abs loads and variations |

- "The last column is an honest estimate, not a promise." The front lever at 20 to 30 s is a 9 to 15 month goal. The full planche is likely 12+ months away. (p.2)
- Retest everything in weeks 8, 16 and 24. (p.2)
- Week 0 values are preloaded and can be edited at onboarding. [B] Editing them changes only the handstand starting time (65% rule) and the GTG reps (40% rule). [D48]

---

## 2. Core rules (p.2–3)

"Only clean reps count, almost nothing goes to failure, and skills always come before volume."

### 2.1 Rep standards: a rep or hold counts only if… (p.2)

| key | Standard |
|---|---|
| `hspu` | Head reaches the same depth every rep, full lockout at the top, no kip. |
| `pushup90` | Start and end in a handstand, lower until the body is horizontal, press back up. A rep that stops at 80 degrees is logged as partial, not counted. |
| `archer` | The extended arm stays fully straight. Bent-arm reps are logged as assisted, not counted. |
| `handstand` | The clock stops at the first step, hand shift or broken line. |
| `frontLever` | Straight arms, hips in line with shoulders. The clock stops when the hips drop. |
| `flag` | Body parallel to the ground (within about 10 degrees). |
| `muscleUp` | Dead hang start, no kip, no chicken wing, full dip lockout. |
| `planche` | Straight arms, shoulders protracted, hips at shoulder height. Adv tuck counts only with a flat back. |
| `tempo` (fallback) | Controlled, about 2 s down. Negatives: 3 to 5 s down. Used for exercises the PDF gives no standard for. [D10] |

### 2.2 Effort (p.2)
- Strength and rep work: stop at the RIR (reps in reserve) written for each exercise, usually 1 to 3.
- Holds: end the set 1 to 2 s before form breaks.
- Failure is only allowed on test days and on abs (RIR 0 to 1).
- "One grinding set to failure costs more recovery than 2 extra clean sets. If a set turns ugly, end it."

### 2.3 Session order (p.2–3)
1. Warm-up, 10 min: wrist circles and wrist push-ups, scapular push-ups and pulls, band dislocates, 2 light planche leans.
2. Skills and max-intensity work (holds, singles).
3. Strength (weighted, heavy variants).
4. Volume (rep work).
5. Accessories.
6. Abs last.

### 2.4 Rest, tempo, time (p.3)

| Work type | Rest |
|---|---|
| Max holds, singles, weighted sets | 2 to 3 min |
| Volume sets | 90 to 120 s |
| Accessories | 60 to 90 s |
| Abs | 60 s |

- Default tempo: controlled, about 2 s down. Negatives: 3 to 5 s down.
- Sessions run 60 to 75 min. If one runs long, cut accessories first, never blocks 2 and 3.
- Each session table below gives its own rest for every line. The table above is only used for steps the session tables don't list. [D06–D08]

---

## 3. Calendar structure

### 3.1 The 7-day cycle (p.3–4)
"Train 5 days per 7-day cycle: 4 full sessions plus 1 short skill session. Run it by day numbers (1 to 7), not weekdays, so a missed day shifts the cycle instead of breaking it."

| Day | Session | Main work | Time |
|---|---|---|---|
| 1 | Push A (intensity) | Handstand, planche holds, 90 degree singles, archer HSPU, abs A | ~70 min |
| 2 | Pull A (intensity) | High pulls, weighted MU, front lever heavy, weighted pull-ups, flag | ~70 min |
| 3 | Off or tricking | Optional 5 min easy handstand practice | 0 to 5 min |
| 4 | Push B (volume) | Handstand max, HSPU volume, 90 degree holds and negatives, dips, abs B | ~65 min |
| 5 | Pull B (volume) | MU volume, front lever volume, flag volume, pull-ups | ~65 min |
| 6 | Skill (short) | Handstand practice, light planche, flag on straight bar, abs C | ~30 min |
| 7 | Off | Full rest | 0 |

### 3.2 Weekly exposures per skill (p.4)
The engine tests check these against every normal loading week:
- Handstand: 3 to 4 (Day 1, Day 4, Day 6, plus optional Day 3).
- Planche: 3 (Day 1 heavy, Day 4 bent-arm carryover through the 90 degree work, Day 6 light).
- Front lever: 2. Flag: 3 (one of them skill only). Muscle-up: 2. HSPU family: 2.
- Abs: 3.

"Why not every day: tendons (elbows, wrists, biceps tendon) recover slower than muscle, and planche, front lever and flag all load them hard."

### 3.3 Blocks (p.10)
"Three 8-week blocks: 7 loading weeks, then 1 deload and test week. Your current numbers are the week 0 test."

| Block | Weeks | Focus | What changes |
|---|---|---|---|
| 1. Base | 1 to 7, deload and test in 8 | Volume at moderate intensity | Double progression everywhere, +5 kg weighted work, one-leg planche and one-leg lever |
| 2. Intensity | 9 to 15, deload and test in 16 | Heavier and denser | Total-reps method for HSPU and MU, +10 kg MU, straddle lever, half-straddle planche |
| 3. Peak | 17 to 23, deload and test in 24 | Quality and top sets | Higher rep totals, top sets, no-transition MU attempts, longer holds |

"After week 24, compare tests, set new baselines and run the cycle again with updated starting numbers." (§16)

Note: in this table, straddle lever, half-straddle planche and +10 kg MU appear in Block 2. The progression rules (§7) trigger them by performance instead. The engine follows the rule triggers. [D12 ⚑]

### 3.4 Cycle mechanics
- Position = cycle number, block (1–3), week (1–24 overall, 1–8 inside the block), day (1–7). `block = ceil(week / 8)`.
- Missed a day: shift the cycle, never double up. (p.14)
- Today = the next uncompleted cycle day. [B]
- At most one cycle day can be completed per local calendar date. A session belongs to the date it started on. [B] [D55]
- Off days (3 and 7) complete automatically when the calendar date on which they became due ends. [B]
- The week number goes up after Day 7. Weeks 8, 16 and 24 are deload and test weeks. [B]
- Early deload weeks can be inserted (§12). They don't count toward the 24 weeks. [D45]

---

## 4. Warm-up (p.2, every session and every test day)

10 min, auto-advancing [B]. The split between items is mine [D09]:

| # | Item | Seconds |
|---|---|---|
| 1 | Wrist circles | 90 |
| 2 | Wrist push-ups | 120 |
| 3 | Scapular push-ups | 120 |
| 4 | Scapular pulls | 120 |
| 5 | Band dislocates | 90 |
| 6 | Light planche lean | 20 |
| 7 | Shake out | 20 |
| 8 | Light planche lean | 20 |

---

## 5. Exercise catalog

`type` uses the brief's set: reps | hold | perSideReps | perLegHold | emom | practice. I added `attempts` (yes/no rows) and the `weighted` flag. "Cue" is the Notes text from the PDF session tables. "Std" is the rep standard key from §2.1.

| id | Name | type | Cue (PDF notes) | Std |
|---|---|---|---|---|
| `handstand` | Freestanding handstand | hold | ~65% of your max · Log the max every week | handstand |
| `handstandPractice` | Handstand practice | practice (minutes) | Balance quality, no max attempts | handstand |
| `chestToWall` | Chest-to-wall handstand hold | hold | Conditional, see §7.4 H1 (p.8) | handstand |
| `plancheOneLeg` | One-leg planche | perLegHold | Stop before hips drop | planche |
| `plancheAdvTuck` | Adv tuck planche | hold | Flat back only | planche |
| `plancheHalfStraddle` | Half-straddle planche | hold | After the level switch (p.9) [D26] | planche |
| `plancheBandStraddle` | Band-assisted straddle planche | hold | After the level switch (p.9) [D26] | planche |
| `plancheLight` | Planche, light | perLegHold (one-leg) or hold (adv tuck) | Effort about 6 out of 10 | planche |
| `pushup90` | 90 degree push-up | emom | Stop the block if a rep drops to 80 degrees | pushup90 |
| `hold90` | 90 degree holds | hold | Static at the horizontal position | pushup90 |
| `negative90` | 90 degree negatives | reps | From handstand to horizontal, 5 s down | pushup90 |
| `archerHspu` | Archer HSPU | perSideReps | Straight extended arm · First rep on each side: 3 s negative (p.8) | archer |
| `hspu` | HSPU | reps (Block 1), total reps (Blocks 2–3) | Main rep builder | hspu |
| `pseudoPlanchePushup` | Pseudo planche push-ups | reps | Shoulders ahead of hands | tempo |
| `dips` | Straight bar dips | reps | Carries over to muscle-up lockout | tempo |
| `highPull` | Explosive high pull-ups | reps | Pull the bar to lower chest or higher, done fresh | tempo |
| `weightedMu` | Weighted muscle-up | reps, weighted | Dip belt or backpack | muscleUp |
| `ntMu` | No-transition muscle-up | attempts | 3 attempts at the start of Day 2, before everything else (p.9) | muscleUp |
| `flCluster` | Front lever clusters | hold | Full lever, ~60% of a 5 s bad day | frontLever |
| `flRaise` | Front lever raises | reps | From inverted hang to lever, slow | frontLever |
| `weightedPullup` | Weighted pull-ups | reps, weighted | Pick the load where 5 reps leave 2 in the tank | tempo |
| `flag` | Human flag (monkey bars) | hold (sided) | Both sides if you train both | flag |
| `muscleUp` | Muscle-up | emom (Block 1), total reps (Blocks 2–3) | Main rep builder, RIR 2+ | muscleUp |
| `flOneLeg` | One-leg front lever | perLegHold | Longer holds at an easier level | frontLever |
| `flStraddle` | Straddle front lever | hold | After the level switch (p.8) | frontLever |
| `tuckFlRow` | Tuck front lever rows | reps | Pull to the bar keeping the lever line | frontLever |
| `pullup` | Pull-ups | reps | Endurance base for muscle-ups | tempo |
| `flagStraddle` | Straddle flag | hold (sided) | Easier level, longer holds | flag |
| `flagNegative` | Flag negatives | reps | Lower from vertical to horizontal, slow | flag |
| `flagStraightBar` | Flag on straight bar | attempts | Skill practice, not effort · Same hand spacing as on monkey bars (p.9) | flag |
| `declineCrunch` | Weighted decline crunch or sit-up | reps, weighted | Plate on chest, start at 5 kg | tempo |
| `legRaise` | Strict hanging leg raise (variation chain §10) | reps | No swing, toes to bar when possible | tempo |
| `dragonFlagNeg` | Dragon flag negatives | reps | 5 s down · Full dragon flags once negatives are easy | tempo |
| `dragonFlag` | Dragon flag | reps | After negatives are easy [D39] | tempo |
| `abWheel` | Ab wheel rollout (knees, then standing) | reps | Knees first, then standing · Only if you have one | tempo |
| `lSit` | L-sit or V-sit compression | hold | Supports handstand and press work | tempo |
| `weightedCrunch` | Weighted crunch | reps, weighted | Plate on chest | tempo |

---

## 6. Sessions: Block 1, week 1 numbers (p.4–7)

"These are the Block 1, week 1 numbers. The progression rules in the next section say how each line changes. Every session starts with the 10 min warm-up." Rule ids point to §7.4.

### Day 1: Push A (intensity), ~70 min

| # | Exercise | Sets x reps or time | Rest | RIR | Rule |
|---|---|---|---|---|---|
| 1 | `handstand` | 4 x 35 s | 90 s | n/a | H1 |
| 2 | `plancheOneLeg` | 6 x 3 s, alternate legs (each set = left + right [D01 ⚑]) | 2 min | n/a | P1 |
| 3 | `plancheAdvTuck` | 3 x 8 s | 2 min | n/a | P2, replaced at P-SW |
| 4 | `pushup90` | EMOM 6 singles | rest of minute | n/a | N1 |
| 5 | `archerHspu` | 4 x 2 per side | 3 min | 1–3 [D05] | A1 |
| 6 | `pseudoPlanchePushup` | 3 x 8 | 90 s | 2 | PP1 |
| 7 | Abs A | §10 | 60 s | 0–1 | §10 |

### Day 2: Pull A (intensity), ~70 min

| # | Exercise | Sets x reps or time | Rest | RIR | Rule |
|---|---|---|---|---|---|
| 0 | `ntMu` | 3 attempts, only once unlocked (§7.7), before everything else | 3 min [D08] | n/a | none |
| 1 | `highPull` | 5 x 3 | 2 min | 1–3 [D05] | fixed + bar height log |
| 2 | `weightedMu` | 4 x 2 at +5 kg | 3 min | 1–3 [D05] | W1 |
| 3 | `flCluster` | 6 x 3 s | 90 s | n/a | F1 |
| 4 | `flRaise` | 3 x 3 | 2 min | 1–3 [D05] | F2 |
| 5 | `weightedPullup` | 4 x 5 at the starting load | 2 to 3 min → 150 s [D06] | 2 | WP1 |
| 6 | `flag` | 6 x 2 s | 90 s | n/a | G1 |

### Day 3: Off or tricking
Optional 5 min easy handstand practice. GTG on Day 3 if enabled (§11).

### Day 4: Push B (volume), ~65 min

| # | Exercise | Sets x reps or time | Rest | RIR | Rule |
|---|---|---|---|---|---|
| 1 | `handstand` | 1 max attempt + 3 x 35 s | 90 s (2 min after the max [D08]) | n/a | max → H1 |
| 2 | `hspu` | 5 x 6 | 2 min | 2 to 3 | S1 / S2 / S3 by block |
| 3 | `hold90` | 4 x 5 s | 2 min | n/a | N2 |
| 4 | `negative90` | 3 x 1, 5 s down | 2 min | n/a | fixed |
| 5 | `dips` | 3 x 12 | 90 s | 2 | DP1 |
| 6 | Abs B | §10 | 60 s | 0–1 | §10 |

### Day 5: Pull B (volume), ~65 min

| # | Exercise | Sets x reps or time | Rest | RIR | Rule |
|---|---|---|---|---|---|
| 1 | `muscleUp` | EMOM 8 x 3 | rest of minute | 2+ | M1 / M2 / M3 by block |
| 2 | `flOneLeg` | 4 x 8 s, alternate legs (each set = left + right [D01 ⚑]) | 2 min | n/a | F3 |
| 3 | `tuckFlRow` | 3 x 6 | 90 s | 1–3 [D05] | F4 |
| 4 | `pullup` | 3 x 10 | 2 min | 2 | PU1 |
| 5 | `flagStraddle` | 3 x 6 s | 90 s | n/a | G2 |
| 6 | `flagNegative` | 3 x 1, slow | 90 s | n/a | fixed |

### Day 6: Skill (short), ~30 min

| # | Exercise | Sets x reps or time | Rest | Notes | Rule |
|---|---|---|---|---|---|
| 1 | `handstandPractice` | 10 min free | as needed (90 s after [D07]) | no max attempts | none |
| 1b | `chestToWall` | 2 x 60 s, only while the last max ended at the shoulders | 90 s | p.8 | fixed [D31] |
| 2 | `plancheLight` | 5 x 3 s one-leg (per leg) or adv tuck | 2 min | effort ~6/10, "about 30 s total" (p.9) | fixed [D32] |
| 3 | `flagStraightBar` | 4 to 5 attempts → 5 | 2 min | skill practice, not effort | none [D33] |
| 4 | Abs C | §10 | 60 s | | §10 |

GTG on Day 6 if enabled (§11).

### Day 7: Off
Full rest.

### Inserted steps (not in the session tables)
- `ntMu` attempts at the start of Day 2, once unlocked (p.9).
- `chestToWall` on Day 6 after handstand practice, when the condition holds (p.8).
- Flag balance sets on the other side, for people who flag on one side only (p.9) [D34].
- HSPU top set at RIR 1 opening the HSPU work in weeks 18, 20 and 22 (p.7).

---

## 7. Progression

### 7.1 Success rule (p.7)
"Every line progresses by one rule: add a rep, a second or a set only when the whole session was clean at the target RIR. If one set failed the standard, repeat the same numbers next time."

The engine applies this per line [D03]. A line succeeds when:
1. every prescribed set (or round, or hold) was completed at the prescribed reps or seconds, and
2. every set was marked clean, and
3. the effort rating, where one is asked, was not **Hard** [B].

Otherwise the next session repeats the same numbers.

### 7.2 Effort rating [B] [D04]
One tap after the last set of a progressing rep line: **Easy / Right / Hard**.
- Easy: more left in reserve than the target RIR.
- Right: about the target RIR.
- Hard: below the target RIR, or grinding.

Hard blocks progression. For abs (RIR 0–1), "Right" means near failure. The rating is not asked for holds, negatives, high pulls, attempts, practice, tests, or deload lines other than abs.

### 7.3 Rule types

| Type | Mechanism |
|---|---|
| DP (double progression) | Per-set reps array. On success, add 1 rep to the leftmost set with the fewest reps. The sets climb together and pass through every "N x k" on the way: 4x2 → 4x3 → 4x4. [D02] At the top: "at top" action. |
| SEQ (sequence) | A fixed list. On success, go to the next entry. At the end: hold. |
| TIME | On success, add +Δ seconds to every set, up to a cap. |
| PCT | Working time = round to 5 s of 65% of the latest max. |
| LOAD | (load, reps) ladder. |
| TOTAL | Fixed total reps in as few sets as possible. Log the number of sets used. |
| LEVEL | When the top is reached with a successful session, switch exercise or variation. |
| FIXED | No progression. |
| Hold at top | When a line reaches the end of what the PDF specifies, it repeats its top numbers. [D13] |

### 7.4 Per-line rules

| Rule | Line | Start | On success | Top / end | At top | Source |
|---|---|---|---|---|---|---|
| H1 | Handstand working sets (Day 1 + Day 4) | 35 s = round5(0.65 × 55) | +5 s per set, once per cycle week, if every handstand working set that week was clean [D29] | none | n/a | p.8 |
| H1-max | Day 4 max attempt (and test maxes) | n/a | If it beats the max currently used as the base: W = max(W, round5(0.65 × new max)) from the next session [D30 ⚑] | n/a | n/a | p.8 |
| H1-c2w | Chest-to-wall | n/a | "If balance is fine but shoulders give out first, add 2 x 60 s chest-to-wall holds on Day 6." After each max: one tap, "Balance / Shoulders" [D31] | n/a | n/a | p.8 |
| P1 | One-leg planche | 6 x 3 s per leg | +1 s per set [D11] | 6 x 5 s, both legs | hold + triggers P-SW | p.9 |
| P2 | Adv tuck planche | 3 x 8 s | +1 s per set [D11] | 3 x 12 s | hold until P-SW | p.9 |
| P-SW | Planche level switch | n/a | When one-leg 6 x 5 s is clean on both legs [D27]: replace adv tuck with half-straddle holds and band-assisted straddle holds | n/a | n/a | p.9 |
| P3 | Half-straddle (after P-SW) | 3 x 4 s [D26 ⚑] | +1 s per set | 3 x 8 s | hold | D26 |
| P4 | Band-assisted straddle (after P-SW) | 3 x 5 s [D26 ⚑] | +1 s per set | 3 x 10 s | "Use a lighter band", restart at 3 x 5 s | D26 |
| N1 | 90 degree push-up | EMOM 6 singles | SEQ: EMOM 6x1, 7x1, 8x1 → every 2 min 4x2, 5x2, 3x3 [D15] | 3 x 3 | hold | p.7–8 |
| N1-stop | 90 degree push-up | n/a | If a single (or any rep) stops at ~80 degrees: log it as partial, end the line for the day [D16] | n/a | n/a | p.8 |
| N2 | 90 degree holds | 4 x 5 s | +1 s per set per week (= per Day 4 session) | 4 x 10 s | hold | p.8 |
| N3 | 90 degree negatives | 3 x 1, 5 s down | fixed ("stay at 3 x 1") | n/a | n/a | p.8 |
| A1 | Archer HSPU | 4 x 2 per side | DP, +1 rep per side to one set | 4 x 4 per side | hold | p.8 |
| A1-x | Archer bent-arm volume | n/a | "You can do one extra set of them at the end as assisted volume." Off by default, Settings toggle, logged as assisted [D17] | n/a | n/a | p.8 |
| PP1 | Pseudo planche push-ups | 3 x 8, RIR 2 | DP | 3 x 12 [D25 ⚑] | hold | D25 |
| S1 | HSPU, Block 1 | 5 x 6, RIR 2–3 | DP | 5 x 8 at RIR 2 → add a 6th set of 6, which climbs to 8 [D20] | hold at 6 x 8 | p.7 |
| S2 | HSPU, Block 2 | Total 50, RIR 2 | TOTAL: same total; progress = fewer sets (e.g. 8 → 5) [D21] | n/a | n/a | p.7 |
| S3 | HSPU, Block 3 | Total 60, then 70 [D18 ⚑] | Weeks 18, 20, 22 open with one top set at RIR 1 that counts toward the total [D19] | n/a | n/a | p.7 |
| DP1 | Straight bar dips | 3 x 12, RIR 2 | DP | 3 x 15 | hold | p.9 |
| HP | Explosive high pull-ups | 5 x 3 | fixed reps. Progress = bar height, chest → lower chest → waist, logged with one tap after the exercise [D35] | waist | n/a | p.9 |
| W1 | Weighted muscle-up | 4 x 2 at +5 kg | LOAD: 4x2 → 4x3 → 4x4, then +step at 4x2, and repeat. step = plate increment setting (5 kg default ⇒ +10 kg) [D23] | none | n/a | p.9 |
| F1 | Front lever clusters | 6 x 3 s | SEQ: 6x3, 8x3, 6x4, 8x4, then by the same rule "add holds first, then seconds": 6x5, 8x5, 6x6… [D14] | n/a | n/a | p.8 |
| F2 | Front lever raises | 3 x 3 | DP | 3 x 5 | hold | p.8 |
| WP1 | Weighted pull-ups | 4 x 5 at the onboarding load, RIR 2 | DP | 4 x 8 [D24 ⚑] | +increment, back to 4 x 5 | p.5, p.10 |
| G1 | Human flag, Day 2 | 6 x 2 s | SEQ: 6x2, 6x3, 5x4, 5x5 | 5 x 5 s | hold | p.8 |
| M1 | Muscle-up, Block 1 | EMOM 8 x 3 | SEQ: 8x3, 10x3, 8x4, 10x4 | EMOM 10 x 4 | hold | p.9 |
| M2 | Muscle-up, Block 2 | Total 30, RIR 2 | TOTAL | n/a | n/a | p.9 |
| M3 | Muscle-up, Block 3 | Total 40, RIR 2 | TOTAL. Week 22 (block week 6): AMRAP test replaces the total that day [D22 ⚑] | n/a | n/a | p.9 |
| F3 | One-leg front lever | 4 x 8 s per leg | +1 s per set [D11] | 4 x 15 s | LEVEL: switch to straddle (replaces one-leg) [D28] | p.8 |
| F3b | Straddle front lever | 4 x 6 s | +1 s per set [D11] | 4 x 12 s | hold | p.8 |
| F4 | Tuck front lever rows | 3 x 6 | DP | 3 x 10 [D25 ⚑] | hold | D25 |
| PU1 | Pull-ups | 3 x 10, RIR 2 | DP | 3 x 15 | hold | p.9 |
| G2 | Straddle flag | 3 x 6 s | +1 s per set [D11] | 3 x 10 s | hold | p.8 |
| G3 | Flag negatives | 3 x 1, slow | fixed ("plus 3 slow negatives") | n/a | n/a | p.8 |
| G4 | Flag on straight bar | 5 attempts | none. "Attempts only… improves with practice, not with effort." | n/a | n/a | p.9 |
| G-bal | Flag balance sets | n/a | "If you only flag on one side, add 1 to 2 sets on the other side for shoulder balance." [D34] | n/a | n/a | p.9 |

### 7.5 Block-dependent methods (p.7, p.9, p.10)

| Line | Block 1 (wk 1–7) | Block 2 (wk 9–15) | Block 3 (wk 17–23) |
|---|---|---|---|
| HSPU (Day 4) | DP from 5 x 6 (S1) | Total 50, RIR 2, log sets (S2) | Total 60 then 70; top set at RIR 1 in weeks 18, 20, 22 (S3) |
| Muscle-up (Day 5) | EMOM ladder (M1) | Total 30, RIR 2 (M2) | Total 40; AMRAP in week 22 (M3) |

All other lines carry their state across blocks.

The PDF explains the HSPU math: "a set of 6 on an 11-rep max is ~55% of max. As the max rises, the same 6 reps cost less, so more total reps fit in a session, which pushes the max again."

### 7.6 Level switches
- Planche: one-leg 6 x 5 s clean on both legs → adv tuck is replaced by half-straddle + band-assisted straddle. Level order: adv tuck, one-leg, straddle, full. (p.9)
- Front lever: one-leg 4 x 15 s → straddle 4 x 6 s, up to 4 x 12 s. (p.8)
- Abs variations: §10.

### 7.7 Unlock: no-transition muscle-up (p.9)
"When to start attempts (rough rule of thumb): 3 clean explosive pull-ups to the lower chest or waist, and +10 kg muscle-ups for 3 clean reps. Then do 3 attempts at the start of Day 2, before everything else."

The engine's version [D36]:
- (a) A high-pull exercise was logged at lower chest or waist with at least one clean set of 3.
- (b) A clean weighted MU set of ≥3 reps at ≥ +10 kg was logged.
- Once both have happened (in any sessions), the attempts unlock for good.
- Today then shows "No-transition attempts unlocked".

### 7.8 Projection: Block 1 if every session succeeds
This is the fastest the engine can move. Real logs will be slower. Read this table to judge the pace.

| Line | W1 | W2 | W3 | W4 | W5 | W6 | W7 |
|---|---|---|---|---|---|---|---|
| Handstand sets | 35 s | 40 | 45 | 50 | 55 | 60 | 65 |
| One-leg planche (per leg) | 6x3 s | 6x4 | 6x5 | 6x5 | 6x5 | 6x5 | 6x5 |
| Adv tuck → half-straddle + band straddle | 3x8 s | 3x9 | 3x10 | 3x4 + 3x5 | 3x5 + 3x6 | 3x6 + 3x7 | 3x7 + 3x8 |
| 90 degree push-up | EMOM 6x1 | 7x1 | 8x1 | 4x2 /2 min | 5x2 | 3x3 | 3x3 |
| 90 degree holds | 4x5 s | 4x6 | 4x7 | 4x8 | 4x9 | 4x10 | 4x10 |
| Archer HSPU (per side) | 2,2,2,2 | 3,2,2,2 | 3,3,2,2 | 3,3,3,2 | 3,3,3,3 | 4,3,3,3 | 4,4,3,3 |
| HSPU | 5x6 | 7,6,6,6,6 | 7,7,6,6,6 | 7,7,7,6,6 | 7,7,7,7,6 | 5x7 | 8,7,7,7,7 |
| Weighted MU (5 kg step) | +5 4x2 | +5 4x3 | +5 4x4 | +10 4x2 | +10 4x3 | +10 4x4 | +15 4x2 |
| FL clusters | 6x3 s | 8x3 | 6x4 | 8x4 | 6x5 | 8x5 | 6x6 |
| FL raises | 3x3 | 4,3,3 | 4,4,3 | 3x4 | 5,4,4 | 5,5,4 | 3x5 |
| Weighted pull-ups | 4x5 | 6,5,5,5 | 6,6,5,5 | 6,6,6,5 | 4x6 | 7,6,6,6 | 7,7,6,6 |
| Flag (Day 2) | 6x2 s | 6x3 | 5x4 | 5x5 | 5x5 | 5x5 | 5x5 |
| Muscle-up EMOM | 8x3 | 10x3 | 8x4 | 10x4 | 10x4 | 10x4 | 10x4 |
| One-leg FL (per leg) | 4x8 s | 4x9 | 4x10 | 4x11 | 4x12 | 4x13 | 4x14 |
| Straddle flag | 3x6 s | 3x7 | 3x8 | 3x9 | 3x10 | 3x10 | 3x10 |
| Pull-ups / dips | 3x10 / 3x12 | +1 rep to one set each week | … | … | … | … | 3x12 / 3x14 |

Earliest possible no-transition unlock: week 5 (+10 kg 4x3), if the high pulls reach lower chest by then. Compare: the goals table says "attempts start in Block 3" and the block table puts +10 kg MU in Block 2. [D12 ⚑]

---

## 8. Deload week (p.10)
- "Same exercises, half the sets, RIR 4, no max attempts."
- "Abs and handstand practice continue as normal."
- Engine details [D43]:
  - Sets = ceil(sets / 2), keeping the first sets.
  - EMOM rounds = ceil(rounds / 2). Total-reps lines run at half the total.
  - Same reps, seconds and loads. RIR 4 is shown.
  - Removed: the Day 4 handstand max, NT MU attempts, the HSPU top set, the MU AMRAP.
  - No effort rating and no progression, except abs.
- Scheduled deload weeks 8, 16, 24 [B] [D44]:

| Day | Content |
|---|---|
| 1 | Push A, deload |
| 2 | Pull A, deload |
| 3 | Off |
| 4 | Test: push (§9), then Abs B as normal |
| 5 | Test: pull (§9) |
| 6 | Test: flag and planche (§9), then handstand practice and Abs C as normal |
| 7 | Off |

- Inserted early deload week (§12): Days 1, 2, 4, 5, 6 as deload sessions. No tests. [D45]
- No GTG in deload or test weeks (p.13).

---

## 9. Test protocol (weeks 8, 16, 24) (p.10)
- "Test on 3 separate days inside the deload week: push, pull, then planche and flag."
- "Same time of day, same surface, full warm-up, film every attempt." Today shows this on test days.
- "Count only reps that pass the Rep standards."

| Test day | Order (PDF) | Step types | Rest |
|---|---|---|---|
| Push (Day 4) | 1 Handstand max · 2 90 degree max · 3 Archer HSPU max per side (left, then right) · 4 HSPU AMRAP last ("it fatigues everything else") | maxHold, amrap, amrap ×2, amrap | 3 min between tests [D08] |
| Pull (Day 5) | 1 Front lever max hold · 2 Muscle-up AMRAP | maxHold, amrap | 3 min |
| Third day (Day 6) | 1 Human flag max · 2 Planche holds per level · 3 No-transition MU attempt if criteria are met | maxHold (main side, both if you flag both [D34]); maxHold per level, hardest trained level first: half-straddle (if unlocked), one-leg L, one-leg R, adv tuck [D46]; attempts ×3 | 3 min |

Test results feed [D47]:
- The handstand base (H1-max).
- GTG reps (§11).
- Progress charts and the week 24 summary.
- The next-cycle baselines (§16).

They don't reset other lines.

---

## 10. Abs routine (hypertrophy) (p.11)
"Abs grow like any muscle, from load and sets close to failure, not from long hollow holds. The target is 10 to 14 hard sets per week across 3 sessions, at 6 to 15 reps, RIR 0 to 1."

| Session | id | Exercise | Sets x reps | Load or level | Rest | Progression |
|---|---|---|---|---|---|---|
| Abs A (Day 1) | `declineCrunch` | Weighted decline crunch or sit-up | 3 x 8 to 12 | Plate on chest, start at 5 kg | 60 s | DP 3x8 → 3x12, then +5 kg, back to 3x8 [D37] |
| Abs A (Day 1) | `legRaise` | Strict hanging leg raise | 3 x 8 to 12 | No swing, toes to bar when possible | 60 s | DP 3x8 → 3x12, then the next variation at 3x8 [D38] |
| Abs B (Day 4) | `dragonFlagNeg` | Dragon flag negatives | 3 x 5, 5 s down | Full dragon flags once negatives are easy | 60 s | fixed; a clean session rated Easy switches to full dragon flags 3x3 → 3x5 [D39 ⚑] |
| Abs B (Day 4) | `abWheel` | Ab wheel rollout (if you have one) | 2 x 8 to 12 | Knees first, then standing | 60 s | DP 2x8 → 2x12 knees, then standing 2x8 → 2x12 [D40] |
| Abs C (Day 6) | `lSit` | L-sit or V-sit compression | 4 x 10 to 15 s | Supports handstand and press work | 60 s | +1 s per set, 4x10 → 4x15 s, then V-sit 4x10 → 4x15 s [D41] |
| Abs C (Day 6) | `weightedCrunch` | Weighted crunch | 3 x 10 to 15 | Plate on chest (start 5 kg [D37]) | 60 s | DP 3x10 → 3x15, then +5 kg, back to 3x10 |

Rules (p.11):
- "Double progression: when all sets reach the top of the rep range, add load (5 kg to 10 kg) or move to a harder variation."
- "Leg raise progression: hanging knee raise, strict leg raise, toes to bar, then slower negatives." The table starts at strict leg raise.
- "Obliques are already trained hard by the flag, so no extra oblique work is needed."
- Hard sets per week: 3 + 3 + 3 + 2 + 3 = 14. L-sit compression is not counted as a hypertrophy set. Without an ab wheel: 12. Both fit 10 to 14.
- Abs progress normally in deload and test weeks [D42].

---

## 11. GTG (optional, no alarms) (p.12–13)
- Off by default [B]. "GTG is optional. It gives a real but modest boost to muscle-up and HSPU reps, and skipping it costs you little."
- Days: Day 3 and Day 6 only.
- Moves: muscle-ups (3 reps per set) and wall HSPU (4 reps per set), both ~40% of max. The engine uses round(0.4 × latest test max): 0.4 × 7 → 3 and 0.4 × 11 → 4 for week 0 [D54].
- Sets: 4 to 5 per day, no alarms. "Attach each set to something you already do… A missed set does not matter." The checklist has 5 rows.
- Bar: "muscle-up GTG needs a bar at home. If you only have outdoor monkey bars, do HSPU GTG only." Settings has "home pull-up bar" [D57].
- Rules:
  - Run it in 4-week blocks, then decide whether to keep it [D54].
  - Drop it the moment it feels like a chore.
  - No GTG in deload or test weeks.
  - Never GTG planche, 90 degree push-ups, archer HSPU, front lever or flag.
- The math (informational): +30 MU reps per week against ~24 to 30 on Day 5; +40 HSPU reps per week against ~30 on Day 4.

---

## 12. Recovery, early deload, pain, missed sessions (p.13–14)

### Early deload triggers
"Take the deload week immediately if any of these happens, then resume where you were":
- Joint pain at 3 out of 10 or higher that lasts more than 24 hours (elbow, wrist, biceps tendon, shoulder). Source: check-in.
- Performance drops on 2 sessions in a row of the same day type. Detected from logs [B] [D49].
- Under 6 hours of sleep for 3 or more nights. Source: check-in.

Today then shows "Deload recommended" with [Start deload week] and [Ignore] [B]. An accepted early deload inserts a full 7-day deload week and then resumes at the exact position it paused, without advancing progression [D45].

### Pain and missed sessions
- "Pain at the front of the elbow or shoulder during planche: cut planche volume by 50% for 2 weeks." Check-in toggle [B] [D51].
- "Sharp pain: stop that exercise for the day. Never train through it." Player menu: "Stop exercise (pain)" [D50].
- "Missed a day: shift the cycle, never double up." (§3.4)
- "Missed 2 or more weeks: restart at 80% of your last numbers." Shown when 14+ days have passed since the last completed session, applied with one tap [B] [D52].

### Tricking and sleep (informational, not app behavior)
- Max-effort tricking (540 and 720 attempts, max-height kicks) on Day 3 or Day 7 when possible. If tricking and training land on the same day, separate them by 4+ hours. Hand-supported tricks also load the wrists, so keep planche volume at the low end on those days.
- Aim for 7+ hours of sleep plus the short afternoon nap. Below 7 hours, this volume recovers poorly.

---

## 13. Weekly check-in (p.15) [B]
Due once per cycle week, after Day 7 (or on the first open after it).

| Field | Source |
|---|---|
| Average bodyweight (kg, optional) | PDF template + brief |
| Average sleep (h, optional) | PDF template [D53] |
| Nights under 6 h (0–7) | brief, feeds the p.14 trigger |
| Worst joint pain (0–10) | PDF template + brief |
| Did it last more than 24 h? | brief, feeds the p.14 trigger |
| Planche pain at elbow or shoulder | brief, feeds the p.14 rule |
| Notes | PDF template [D53] |

---

## 14. Equipment (p.14)

| Item | Status in PDF | Why | App effect [D57] |
|---|---|---|---|
| Plates 5 to 20 kg | Have | Weighted MU, pull-ups, abs | n/a |
| Dip belt | Recommended | Stable load for weighted MU ("a dip belt beats a backpack") | cue only |
| 1.25 or 2.5 kg plates | Recommended | Smaller jumps than 5 kg ("5 kg is ~6 to 7% of bodyweight per jump") | Settings: smallest plate increment 5 / 2.5 / 1.25 kg |
| Resistance bands | Recommended | Band-assisted straddle planche and lever | without bands, band-assisted straddle is left out |
| Parallettes | Optional | Wrist comfort for planche and 90 degree work | cue only |
| Pull-up bar at home | Optional | Muscle-up GTG, pull days independent of the park | MU GTG rows need it |

"Open question: which of the recommended items do you already have? The plan adapts if any are missing." (p.14) This is an open question for you. Also: do you own an ab wheel?

---

## 15. Logging (p.14)
"Log every working set. Progression decisions come from the log, not from how a session felt."

The PDF template has these columns: Date · Day · Exercise · Sets x reps or time · Load · RIR · All clean? · Notes.

App mapping:
- Per set: prescribed vs done (reps or seconds), load, side or leg, clean yes/no, partial or assisted count.
- Per line: effort rating (maps to RIR, §7.2), bar height for high pulls, "what ended it" for handstand maxes.
- Per session: date, cycle position, finished or finished early, optional notes.

---

## 16. After week 24 (p.10) [B]
"After week 24, compare tests, set new baselines and run the cycle again with updated starting numbers."
- Show a summary: week 0 vs week 24 for every goal.
- Offer "Start next cycle", using the week 24 tests as the new baselines.
- How the starting numbers update is provisional and will be revisited before week 24 [D56].

---

## 17. PDF content the app shows but does not act on
- Nutrition (p.11–12):
  - Maintenance to a slight deficit, 0 to −150 kcal per day. Never below −200.
  - Protein 1.8 to 2.2 g per kg per day. Most carbs around training.
  - Weigh in 3 to 7 mornings per week and track the weekly average. Target: flat to −0.5 kg per month.
  - "If rep tests stall for 2 weeks, or sleep and energy drop, go back to exact maintenance."
  - The app only plots bodyweight from check-ins, with the target band as a reference [D60].
- Tricking overlap and sleep (§12).
- "If a session runs long, cut accessories first." No time-cut mode is built; it's listed as a suggestion in DECISIONS.md.
