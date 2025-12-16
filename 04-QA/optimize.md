# COMMAND: OPTIMIZE

# ALIAS: perf-loop, slo-tune, refine

## OBJECTIVE

**SLO-DRIVEN PERFORMANCE.**
Define budgets, measure reality, prevent regressions.
**Goal**: Quantified latency/throughput/resource targets with automated enforcement.
**Input**: Results from `03-VERIFY/performance` command.

## VIBE CODING INTEGRATION

AI optimizes for correctness, not performance. Common AI perf issues:

- N+1 queries in loops
- Missing indexes on filtered columns
- Synchronous I/O in hot paths
- Unbounded memory growth

## PROTOCOL

### Phase 1: Budgets & SLIs/SLOs

1. **Define SLIs**: P50/P95/P99 latency, error rate, throughput, memory/CPU
2. **Set SLOs**: e.g., P95 < 300ms for `/api/orders`, error rate < 0.1%
3. **Scope**: Critical paths only (auth, checkout, search)
4. **Perf Budgets**: Per endpoint/function; include payload sizes

### Phase 2: Baseline Measurement (Use `03-VERIFY/performance`)

1. **Local/CI Determinism**:
    - Pin CPU governor; disable turbo if possible
    - Fix input datasets and RNG seeds; isolate noisy neighbors (containers)
2. **Profilers**:
    - **Node/TS**: `clinic flame`, `0x`, built-in profiler
    - **Python**: `py-spy`, `scalene`
    - **Rust/Go**: `pprof`, `perf`
3. **DB Explainability**:
    - Use `EXPLAIN (ANALYZE, BUFFERS)`; forbid seq scans on hot paths
    - Verify indexes on filter/join keys; add statement timeouts

### Phase 3: The Optimization Loop

1. **Identify Hotspots**: Flamegraphs, top-down call stacks
2. **Hypothesis -> Change -> Measure**: One change at a time
3. **Cache & Concurrency**:
    - Add bounded caches with eviction and TTLs
    - Apply backpressure; timeouts with jittered retries; circuit breakers
4. **Memory & GC**:
    - Track allocations; avoid large object churn; pool where sensible

### Phase 4: Database & I/O Hygiene

1. **N+1**: Replace with prefetch/batch queries
2. **Connection Pooling**: Size per CPU and DB limits; avoid thundering herds
3. **Prepared Statements**: Reuse plans for hot queries
4. **Pagination & Streaming**: Avoid loading entire datasets; stream/chunk

## OUTPUT FORMAT

**1. Optimization Report**

```markdown
> Route: `POST /checkout`
> Baseline: P50 120ms, P95 480ms (CPU 65%)
> After: P50 90ms, P95 220ms (CPU 52%)
> Change: Added read-through cache for product lookup (TTL 60s, size 10k)
```

## EXECUTION RULES

1. **REPEATABILITY**: Same input -> same result envelope. If variance > 10%, fix environment
2. **NO CHEATING**: Do not remove work that users rely on just to meet budgets
3. **REGRESSION GUARD**: Add perf check to CI with threshold ratchet (P95/P99 + error rate)
4. **OBSERVABILITY**: Emit metrics/traces; tag by scenario and version; link to commits
5. **DATA SAFETY**: Use synthetic or anonymized data; never prod dumps in CI
