# APEX-AI – How the AI Driver Is Built

APEX-AI is the machine-learning driver of APEX RUSH. A small neural network steers it; no hand-written driving rules do. This document describes its development along the six phases of **CRISP-DM** (Cross-Industry Standard Process for Data Mining).

All numbers below come from the automatically generated **[data analysis report](ai/report.md)** (`pnpm ai:report`, seed 2026). Every step can be reproduced with one command: `pnpm ai:all`.

| Phase | Milestone | Status |
| --- | --- | --- |
| 1. Business Understanding | M6 | ✅ done |
| 2. Data Understanding | M6 | ✅ done |
| 3. Data Preparation | M6 | ✅ done |
| 4. Modeling – stage 1 (behavior cloning) | M6 | ✅ done |
| 4. Modeling – stage 2 (evolution strategy) | M7 | planned |
| 5. Evaluation | M6–M7 | first results, full evaluation in M7 |
| 6. Deployment (AI in every race) | M7 | planned |

```
 Business        Data            Data             Modeling          Evaluation        Deployment
Understanding → Understanding → Preparation →   (MLP, behavior → (unseen test   →  (weights as JSON,
 (goal, KPIs)    (telemetry)     (clean, split)   cloning)          track)            browser inference)
       ↑______________________________________________________________|  iterate
```

---

## 1. Business Understanding

**Goal:** a fast, fair and human-like opponent in every race – whether you play alone or with friends online.

**Why machine learning instead of rules?** The rule-based bots follow the track with fixed formulas. They are predictable and never get better. A learned driver picks up braking points, drift entries and racing lines from data, and it can keep improving with more training (stage 2).

**Success criteria** (measured on a track the model has never seen):

| Criterion | Target | Current result |
| --- | --- | --- |
| Mean best lap compared with the rule-based bot | ≤ 105 % | **102.8 %** ✅ |
| Wall contacts | < 1 per lap | **0.08** ✅ |
| Finish rate | 100 % | **100 %** ✅ |
| Inference time in the browser | < 0.2 ms per step | to be measured in M7 |

**Constraints:** same cars, physics and information as human players (no view of other players' inputs, no cheating), only free tools, runs fully in the browser.

## 2. Data Understanding

**Data source.** There is no ready-made dataset, so the data is generated: the game's physics and race logic were moved into a separate module (`packages/sim`) that runs **without graphics in Node.js**, faster than real time. Nine rule-based bots drive complete races on several tracks; every 4th physics step (15 times per second and car) the simulation records what each bot *saw* (observation) and what it *did* (action).

| Parameter | Value |
| --- | --- |
| Recorded races | 24 (4 tracks × 2 directions × 3 races, 2 laps each) |
| Simulated driving time | 37.6 min with 9 cars per race |
| Samples recorded | 280,754 |
| Features per sample | 24 |
| Targets per sample | 4 |

**Features (inputs).** Everything is normalized to roughly −1…1 and only uses information a human player can see on screen:

| Group | Features |
| --- | --- |
| Motion | speed, airborne, nitro level, sideways sliding speed, yaw rate |
| Track ahead | angle to the track at 10, 20, 40, 60 and 80 m ahead; curvature near and far |
| Position | signed distance from the centre line |
| Surroundings | 7 distance rays to the walls (−90° … +90°) |
| Opponents | position of the 2 nearest cars relative to the own car |

**Targets (outputs):** steering (−1…1), throttle/brake (−1 full brake … +1 full throttle), drift (on/off), nitro (on/off).

**First findings from the analysis** (details in the [report](ai/report.md)):

- **Steering is predictable from the track ahead:** the angle to the track 40 m ahead correlates with the steering value at r = 0.65; the points at 60 m and 20 m follow closely. This confirms that the chosen features carry the right information.
- **Throttle depends on the curvature ahead** (r = −0.37) and on speed (r = −0.20): bots lift off before corners.
- **Strong class imbalance:** drift is active in only **0.4 %** of samples, braking in 9.6 %.
- **Nitro is missing from the data:** the rule-based bots almost never use nitro (0.001 % of samples). So behavior cloning *cannot* learn nitro. This is an important result of this phase: nitro has to be learned in stage 2, where the AI is rewarded for being fast instead of copying the bots.

## 3. Data Preparation

| Step | What and why |
| --- | --- |
| Cleaning | 3,096 samples (1.1 %) removed: 3,024 from the first second of a race (standing start, no meaningful decision) and 72 from the step in which a car was reset. No missing values occurred (0 % non-finite values in all features). |
| Normalization | Fixed scales per feature (e.g. speed / 60 m/s, ray length / 40 m), stored as part of the observation code, so training and the game use exactly the same inputs. |
| Augmentation | Every track is also driven **mirrored** (left ↔ right). This doubles the data and removes any steering bias towards one side (mean steering after augmentation: −0.002). |
| Split by track | Training: Neon Harbor and Sunset Canyon (+ mirrored), 130,598 samples (47 %). Validation: Skyline Loop (+ mirrored), 68,513 (25 %). Test: Grand Circuit (+ mirrored), 78,547 (28 %). Splitting by track instead of by sample prevents **data leakage**: neighbouring samples of the same corner are almost identical, so a random split would make the results look better than they are. |
| Class weights | Rare positive drift samples are weighted ×10 in the loss so the model does not simply always predict "no drift". |

## 4. Modeling

**Model:** a multilayer perceptron (MLP) written in plain TypeScript without any machine-learning library, so every computation is visible in the code (`packages/ai/src/mlp.ts`).

| Parameter | Value |
| --- | --- |
| Architecture | 24 → 32 → 32 → 4, tanh in the hidden layers |
| Outputs | steering and throttle through tanh (regression), drift and nitro through a sigmoid (classification) |
| Trainable parameters | 1,988 |
| Loss | mean squared error (steering, throttle) + weighted binary cross-entropy (drift, nitro) |
| Optimizer | Adam, learning rate 0.002, batch size 256 |
| Training length | 25 epochs with **early stopping**: the weights of the epoch with the lowest validation loss (epoch 10) are kept |

**Stage 1 – Behavior Cloning (supervised learning).** The network learns to imitate the rule-based bots: input = what the bot saw, target = what the bot did.

![Learning curve](ai/learning-curve.svg)

The learning curve shows a typical pattern: the training loss keeps falling (0.42 → 0.15), while the validation loss reaches its minimum early and then rises again – the model starts to memorize the training tracks (**overfitting**). The first version kept the weights of the last epoch; with **early stopping** the best epoch is kept instead. This improved the mean lap time on the test track from 104.9 % to 102.8 % of the rule-based bot and the mean finishing place from 5.2 to 4.3.

**Model metrics on the unseen test track (Grand Circuit):**

| Metric | Value |
| --- | --- |
| Steering MAE / R² | 0.060 / 0.80 |
| Throttle MAE / R² | 0.30 / 0.51 |
| Drift accuracy / precision / recall | 99.9 % / 32 % / 73 % |
| Nitro | not learnable from this data (see Data Understanding) |

Steering is predicted well (R² 0.80). Throttle is harder (R² 0.51) because the bots switch between full throttle and lifting off almost like a switch. Drift is detected in 73 % of the real drift moments (recall), but with many false alarms (precision 32 %), which is expected for such a rare class.

**Stage 2 – Fine-tuning (planned for M7):** an evolution strategy changes the network weights slightly, lets every variant race in the simulation and keeps the faster ones. Reward: progress and lap time; penalties: wall contacts, wrong-way driving, resets. This is also where nitro use is learned.

**Rejected alternatives:**

| Alternative | Reason |
| --- | --- |
| Random split of samples | Leads to data leakage (see Data Preparation). |
| Large ML library (e.g. TensorFlow.js) | Not needed for a model with 1,988 parameters; a library would hide the steps that are meant to be explained. |
| Pure reinforcement learning from scratch | Needs far more simulation time; behavior cloning gives a good starting point first. |

## 5. Evaluation (first results)

APEX-AI drove 6 races (3 per direction, 2 laps each) on the **unseen** Grand Circuit against 9 rule-based bots. As a comparison, a rule-based bot of the highest skill level drove the same races from the same grid slot.

| Metric | APEX-AI | Rule-based bot |
| --- | --- | --- |
| Finish rate | 100 % | 100 % |
| Mean best lap | 44.36 s | 43.13 s |
| Wall contacts per lap | 0.08 | 0.25 |
| Mean distance to the centre line | 2.92 m | 3.24 m |
| Mean finishing place (of 10) | 4.3 | 4.2 |

APEX-AI already reaches the level of the best rule-based bot on a track it has never seen. It drives cleaner (fewer wall contacts) but slightly slower. This is expected for behavior cloning: the model can at most become as good as its teacher. Beating the teacher is the goal of stage 2 in M7.

## 6. Deployment (planned for M7)

- The trained weights are stored as JSON (`packages/ai/models/apex-ai-v1.json`, 19 KB) and versioned in the repository.
- In the game, APEX-AI uses exactly the same observation code and physics as in training; online, the host simulates it.
- Retraining: `pnpm ai:record` → `pnpm ai:train` → `pnpm ai:evaluate` → `pnpm ai:report` (or `pnpm ai:all`).
