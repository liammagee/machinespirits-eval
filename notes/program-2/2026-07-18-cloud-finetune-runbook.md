# Program-2 cloud fine-tuning runbook (Lambda Labs)

Status: RUNBOOK — prepared 2026-07-18 so Phase 3 execution is mechanical.
Nothing here is authorized to run until the Phase 2 prereg freeze and an
explicit go (plan §8). The one exception is §5's stack-proof smoke, which the
freeze itself may treat as environment validation.

## 1. Provider choice: Lambda Labs, not Google Cloud

- Lambda: SSH box with CUDA/PyTorch preinstalled (Lambda Stack), per-hour
  on-demand billing, **no quota tickets, no project/IAM setup**, free data
  egress (checkpoints come home free). A100 ~US$1.99–2.79/hr, H100
  ~US$3.29/hr as of July 2026.
- GCP: needs a project, a GPU quota request (often a support ticket for
  A100/H100), an image choice, and egress fees. Nothing in this workload
  needs GCP's strengths.
- Instance: **1× A100 80GB** (or H100 80GB if A100 unavailable) — bf16 LoRA
  on a 9B fits without thought. 1× A100 40GB also works with QLoRA (4-bit
  base + LoRA); the prereg pins which.

## 2. Division of labour

- **Cloud**: training only (SFT + conditional KTO, per variant).
- **Home**: everything evidential — the frozen grader, the floors, the
  verdicts. Adapters come home and are served locally (MLX or GGUF→ollama,
  as pinned at Phase 2); grading never leaves the machine and never touches
  an LLM.

## 3. Pre-flight (local, before the box exists)

1. Export TRL-format training files from dataset v1 (a small formatter over
   `~/.machinespirits-data/program-2/datasets/v1/`):
   - `sft-instruct.jsonl` — `{"messages": [...]}` chat rows (system +
     history + assistant target), Task A + general positives, train split
     only.
   - `sft-base.jsonl` — `{"text": "<flattened transcript + target>"}` rows
     using the frozen flattening template (Phase 2 freezes
     `program2-base-flatten` — training and evaluation must use the
     identical template).
   - `kto.jsonl` — `{"prompt": ..., "completion": ..., "label": true|false}`
     from the unpaired audit labels, train split only.
2. Record SHA-256s of the exported files against the dataset manifest.
3. `tar czf program2-train-v1.tgz *.jsonl` (~tens of MB — text only).

## 4. Box setup (~10 minutes)

```bash
# on lambda console: launch 1x A100 80GB, add your SSH key
ssh ubuntu@<instance-ip>

python3 -m venv ~/venv && source ~/venv/bin/activate
pip install "trl>=0.14" peft transformers accelerate datasets bitsandbytes
huggingface-cli login   # token needed only to pull Qwen weights

# pull both variants once (~19 GB each, fast pipes)
python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('Qwen/Qwen3.5-9B')
snapshot_download('Qwen/Qwen3.5-9B-Base')
PY
```

Then from the workstation: `scp program2-train-v1.tgz ubuntu@<ip>:` and
unpack.

## 5. Stack-proof smoke (first action on the box)

The 10-example smoke deferred from the workstation (crash note in the Phase
1 report) runs HERE, in the environment that will actually train: SFT on 10
examples, 20 steps, assert loss decreases and an adapter directory appears.
Same script as §6 with `--max_steps 20` and the smoke dataset. Push-notify
milestone: "cloud stack-proof done".

## 6. The frozen runs (post-freeze only; ≤4 total per plan §5)

One script per stage; both are thin TRL wrappers. Sketches (the prereg
freezes the exact configs and seeds):

`train_sft.py` (per variant):

```python
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

variant = "instruct"   # or "base"
model_id = "Qwen/Qwen3.5-9B" if variant == "instruct" else "Qwen/Qwen3.5-9B-Base"
data = load_dataset("json", data_files={"train": f"sft-{variant}.jsonl"})

trainer = SFTTrainer(
    model=model_id,
    train_dataset=data["train"],
    peft_config=LoraConfig(r=32, lora_alpha=64, target_modules="all-linear"),
    args=SFTConfig(
        output_dir=f"out-sft-{variant}",
        num_train_epochs=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=1e-4,
        bf16=True,
        completion_only_loss=True,   # loss on the reply tokens only (plan §5)
        save_strategy="epoch",       # checkpoint export cadence
        logging_steps=10,
        seed=20260718,               # prereg-frozen
    ),
)
trainer.train()
```

`train_kto.py` (conditional, per variant, only if SFT misses the frozen
bar): TRL `KTOTrainer` on `kto.jsonl` starting from the SFT adapter —
unpaired desirable/undesirable labels, which is exactly our audit-label
shape and the reason TRL over axolotl/unsloth (KTO is native; the plan
prohibits constructing DPO pairs through the repair channel).

Runtime arithmetic: ~1.1–6k rows × ~10k-token contexts, LoRA-9B on A100
80GB ≈ well under 1 GPU-hour per SFT run; KTO similar. **All four licensed
runs plus smoke and margin: under ~5 GPU-hours ≈ US$10–15.**

After each run: `scp -r ubuntu@<ip>:out-sft-* ~/.machinespirits-data/program-2/adapters/`
(each checkpoint export = a push-notification milestone), then **terminate
the instance** — billing stops only on termination.

## 7. Bring-home and verdict

1. Serve each adapter locally per the Phase 2 serving pin (merge-and-convert
   to GGUF for ollama, or MLX-convert the merged model — the pin decides;
   precision must match the floor serving of the same arm or be re-floored).
2. Run the frozen grader on held-out moments exactly as in Phase 1:
   `node scripts/program2-floor-grader.mjs --generate --model <served> ...`
3. Compare against the frozen bars (set at Phase 2 against the Phase 1
   floors: instruct arm vs 0.362, base arm vs 0.103, plus blind-review and
   seam checks). No re-runs; the §9 decision grammar reads the result.

## 8. Provenance discipline

- The prereg freezes: dataset SHAs, both training configs (incl. seeds),
  the flattening template, the serving pin, and the bars — before any §6
  command runs.
- Keep the full training logs; record instance type, driver/CUDA, and pip
  freeze into the run record (the cloud box is part of the instrument).
- One SFT + one conditional KTO per variant. No sweeps, no retries
  (no-tune-and-retry from the freeze).

## 9. If I (Claude) am driving

Give me the instance IP once it's up; everything in §§4–6 is scriptable over
SSH from this session with the push-milestone regime already armed
(stack-proof, each checkpoint export, any failure). Alternatively §§4–6
paste-run in order by hand — every command above is complete.
