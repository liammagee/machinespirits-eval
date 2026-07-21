#!/usr/bin/env python3
"""Program-2 — merge a trained LoRA adapter into its pinned base weights
(PROGRAM-2-PHASE2-PREREGISTRATION.md section 4 serving pin; section 10
instrument fault 3; Amendment 2 model-class rule).

VERIFIED MERGE. History: the original version of this file loaded
AutoModelForCausalLM, whose text-only module tree (model.layers.*) silently
mismatches the adapters' VLM-class keys (model.language_model.*) — PEFT
attaches fresh zero adapters and merge_and_unload "succeeds" as a no-op.
Phase 4 caught this by output identity, fixed it on the training box, but
the fixed script was never committed; the stale copy here produced one more
(caught, deleted) no-op on 2026-07-21. This version is the fix, with the
Phase 4 protections in code:

  1. Loads AutoModelForImageTextToText (the VLM tree the adapters expect).
  2. Probes a language_model weight before/after adapter application and
     REFUSES to save unless the merged weight actually moved.
  3. Post-save: zeroes mtp_num_hidden_layers in the merged config (the
     merged save drops the MTP layer; a nonzero count makes GGUF conversion
     emit a block_count the tensor list cannot satisfy) and copies the
     canonical tokenizer files from the pinned snapshot (a transformers
     resave breaks convert_hf_to_gguf's BPE pre-tokenizer recognition).

CPU-only weight arithmetic; run with nothing else memory-heavy resident.
Output: a merged bf16 model directory ready for GGUF conversion.

Usage:
    python program2-merge-adapter.py --variant instruct \
        --adapter ~/.machinespirits-data/program-2/adapters/out-kto-instruct-final \
        --out ~/.machinespirits-data/program-2/merged-kto-instruct
"""

import argparse
import json
import shutil
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from peft import PeftModel
from transformers import AutoModelForImageTextToText, AutoTokenizer

FROZEN = {
    "instruct": {"model": "Qwen/Qwen3.5-9B", "revision": "c202236235762e1c871ad0ccb60c8ee5ba337b9a"},
    "base": {"model": "Qwen/Qwen3.5-9B-Base", "revision": "68c46c4b3498877f3ef123c856ecfde50c39f404"},
}
PROBE = "model.language_model.layers.0.linear_attn.in_proj_a.weight"
TOKENIZER_FILES = ("tokenizer.json", "tokenizer_config.json", "chat_template.jinja")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=["instruct", "base"], required=True)
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    frozen = FROZEN[args.variant]

    model = AutoModelForImageTextToText.from_pretrained(
        frozen["model"],
        revision=frozen["revision"],
        torch_dtype=torch.bfloat16,
        device_map="cpu",
        low_cpu_mem_usage=True,
    )
    before = dict(model.named_parameters())[PROBE].detach().clone()

    model = PeftModel.from_pretrained(model, args.adapter)
    lora_b_max = max(
        (p.detach().abs().max().item() for n, p in model.named_parameters() if "lora_B" in n and "language_model" in n),
        default=0.0,
    )
    assert lora_b_max > 0, "adapter did not attach to the language_model tree (zero lora_B — key mismatch)"

    model = model.merge_and_unload()
    after = dict(model.named_parameters())[PROBE].detach()
    delta = (after.float() - before.float()).abs().max().item()
    assert delta > 0, f"merge is a no-op (probe {PROBE} unchanged) — refusing to save"
    print(f"merge verified: probe delta {delta:.6f}, adapter lora_B max {lora_b_max:.6f}")

    model.save_pretrained(args.out)
    AutoTokenizer.from_pretrained(frozen["model"], revision=frozen["revision"]).save_pretrained(args.out)

    out = Path(args.out)
    config_path = out / "config.json"
    config = json.loads(config_path.read_text())
    changed = False
    for holder in (config, config.get("text_config") or {}):
        if holder.get("mtp_num_hidden_layers"):
            holder["mtp_num_hidden_layers"] = 0
            changed = True
    if changed:
        config_path.write_text(json.dumps(config, indent=2) + "\n")
        print("config: mtp_num_hidden_layers zeroed for GGUF conversion")

    snapshot = Path(
        snapshot_download(frozen["model"], revision=frozen["revision"], allow_patterns=list(TOKENIZER_FILES))
    )
    for name in TOKENIZER_FILES:
        source = snapshot / name
        if source.exists():
            shutil.copy2(source, out / name)
    print(f"canonical tokenizer files restored from snapshot; merged -> {args.out}")


if __name__ == "__main__":
    main()
