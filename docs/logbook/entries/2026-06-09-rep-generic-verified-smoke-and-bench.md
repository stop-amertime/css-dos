# 2026-06-09 - rep-generic verified: smoke 7/7, byte-identical A/B, bench within gate

The "one recogniser gap" was five layered defects; all fixed on calcite
`feat/rep-generic` (`17fe7da`, pushed): (1) `ip_extra_advance_slot` from
the stay-branch subtrahend (fixed-point: wrapper addends cancel), (2)
mirror-name resolution via `to_bare_name` (thread-safe - the
`property_to_address` attempt hung the debugger's tokio workers), (3)
loop-continuation gate (predicate + polarity) so one-shot string ops
don't bulk-apply, (4) shape-recorded ×16 vs flat source bases (kiln's
`--_strSrcSeg` is pre-scaled), (5) `--__1flags` commit no-op → stale
flags. LODS Full-commit now refuses loudly (accumulator not modelled).
Verified: 287 unit tests; calcite-cli A/B vs main byte-identical
(cycles+IP, 7 carts × 2M ticks); smoke 7/7 (111 s); 3-run doom-all
medians 73.8s/459.6K/63.3s vs main 73.4s/466.6K/62.8s = +0.5% wall,
−1.5% t/s (inside noise). JSONs: `docs/benches/doom-all-2026-06-09-*`.
Detail: calcite log 2026-06-09. Merged to calcite main 2026-06-10
(`cc729b2`) after the review warts were fixed - see the 2026-06-10 entry.
