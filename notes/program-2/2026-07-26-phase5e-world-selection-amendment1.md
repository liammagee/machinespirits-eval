# Program-2 Phase 5e world selection — Amendment 1 remeasurement

This reruns the frozen selection metric after the presentation-only `p_warm`
repair. It preserves rather than overwrites the original freeze evidence.
Release-schedule metadata is excluded from the metric by design, so the
ranking and counts remain unchanged; the source hash records the amended
world.

Selected: **world_026_skyway_bakery**.

world_024_emberwick_forum is the raw letter-hostility winner but has 4 rules; selected world_026_skyway_bakery, the lowest-density candidate meeting the >=5-rule floor.

| Rank | World | Frozen-six matches | Words | Matches/1k | Premises | Rules | Structure floor |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | world_024_emberwick_forum | 0 | 851 | 0.00 | 5 | 4 | no |
| 2 | world_026_skyway_bakery | 2 | 894 | 2.24 | 5 | 5 | yes |
| 3 | world_025_tallow_street | 4 | 994 | 4.02 | 6 | 6 | yes |
| 4 | world_023_greyfen_lab | 5 | 836 | 5.98 | 5 | 4 | no |
| 5 | world_022_foxtrot_jukebox | 5 | 614 | 8.14 | 4 | 2 | no |
| 6 | world_028_larkspur_fridge | 6 | 680 | 8.82 | 4 | 2 | no |

Metric: case-insensitive word-boundary counts with possessive/plural suffixes over parsed world prose (setting, questions, glosses, surfaces, and dramaturgy), excluding formal facts/rules/schedules, per 1,000 words.

Selected-world SHA-256:
`73f7d89b147b50c31afce736b1369fd0a15b961f2945147cce5952d46684baf9`.
