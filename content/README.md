# Eval Content

Read-only copy of course content used by the evaluation system.

Source of truth: `~/Dev/machinespirits-content-philosophy`

## Courses

- **479** — Machine Learning and Human Learning (EPOL 479)

## Updating

To refresh from the source:

```bash
cp ~/Dev/machinespirits-content-philosophy/courses/479/*.md content/courses/479/
```

To use the full content-philosophy package instead (all courses):

```bash
export EVAL_CONTENT_PATH="../machinespirits-content-philosophy"
```
