# COMMAND: BENCH

# ALIAS: benchmark, eval, metrics, scorecard

## OBJECTIVE

**BENCHMARKING + METRICS EVALUATION.**
Run a repeatable evaluation of an agent/model across chosen benchmark suites, collect metrics, and emit a scorecard.

## PROTOCOL

1. Select benchmark suites (security + general agent).
2. Freeze config: model, temperature, tools enabled, max steps, budget, seeds, versions.
3. Run on **remote test server** (never localhost). Use `09-OPS/server.md`.
4. Capture raw traces: prompts, tool calls, outputs, timing, tokens/cost.
5. Compute metrics + confidence intervals; report failures with repro commands.

## BENCHMARK MENU (pick what matches your threat model)

### Security / Misuse / Red Team

- **CyberSecEval 4 (2025)**: `https://meta-llama.github.io/PurpleLlama/CyberSecEval/docs/user_guide/getting_started`
- **AI-Pentest-Benchmark (2024/2025)**: `https://github.com/isamu-isozaki/AI-Pentest-Benchmark`
- **HarmBench (2024)**: `https://github.com/centerforaisafety/HarmBench`

### General Agent / Tool Use (useful baselines)

- **SWE-bench / SWE-bench Verified** (software engineering agent tasks): `https://www.swebench.com/`
- **WebArena** (web navigation agents): `https://webarena.dev/`
- **GAIA** (general assistant reasoning + tool use): `https://gaia-benchmark.github.io/`
- **BFCL (Berkeley Function-Calling Leaderboard)** (tool/function calling quality): `https://gorilla.cs.berkeley.edu/leaderboard.html`

## METRICS (must report all of these)

### Effectiveness

- End-to-End Success Rate / Goal Completion
- Time-to-Compromise (TTC) / Time-to-Resolution (for non-security tasks)
- Step Count / Tool-call Count

### Efficiency

- Token/Cost per Success
- Wall-clock Latency (p50/p95) + Compute (if available)
- Human Interventions per Episode (count + reasons)

### Safety / Policy Behavior

- False Refusal Rate (FRR) on allowed tasks
- Attack Success Rate vs Defense (when suite has defended vs undefended variants)

### Reliability

- Variance across seeds (min/mean/max)
- Crash rate / tool error rate / retry rate

## OUTPUT FORMAT

```markdown
# 📊 BENCH REPORT

## Config
- Model:
- Temperature:
- Tools:
- Max steps:
- Budget:
- Remote host:
- Proxy:
- Benchmark suites:
- Date:
- Git SHA (if applicable):

## Results (headline)
- Success rate:
- TTC / TTR:
- Steps / tool calls:
- Cost per success:
- Latency p50/p95:
- Human interventions:
- FRR:
- Attack vs defense:

## Breakdown
- By suite:
- By task type:
- By failure mode:

## Repro
- Exact remote command(s):

## Notes
- Any deviations:
```

## PROMPT PAYLOAD

```text
You are running an evaluation of an LLM/agent. Produce a BENCH REPORT.

Hard rules:
- Run everything on a remote dev box (never localhost). Follow `09-OPS/server.md`.
- If network access is needed, include the proxy export in the remote command prefix.
- Log raw traces (inputs, tool calls, outputs, timing, tokens/cost) and compute metrics.

Inputs:
- Suites to run: {{input}}

Output:
1) A concrete remote command plan (ssh commands).
2) A BENCH REPORT in the specified format.
```
