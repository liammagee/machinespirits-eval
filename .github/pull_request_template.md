## Summary


## Workplan

- [ ] Linked workplan item: <id or N/A>
  <!-- If this placeholder is left unchanged, CI accepts only one exact workplan `branch:` match. -->
- [ ] Updated the item status/branch if this PR starts, blocks, reviews, or closes the work
- [ ] Ran `npm run wp:source-check` if workplan source changed; generated board views are not included

## Ref and version governance

Ref impact: <N/A | repository release | paper checkpoint | experiment checkpoint | archive snapshot>

- [ ] Classified this PR's ref/version impact using `docs/tagging-and-version-protocol.md`
- [ ] If managed versions or archive refs changed, refreshed `docs/ref-status.md` and ran `npm run refs:check`
- [ ] Any managed tag will be created only after merge on the validated `main` commit

## Verification

Tutor PR benchmark (required when tutor generation or deterministic tutor audits can change):

- [ ] N/A — this PR cannot affect tutor generation or its audits
- [ ] Ran `npm run tutor:stub:pr-benchmark` manually or via the installed pre-push hook on the final commit
- Terminal status / local report path: <N/A or status + path>
