#!/usr/bin/env python3
"""Program-2 Phase 4 — merge a trained LoRA adapter into its pinned base
weights (PROGRAM-2-PHASE2-PREREGISTRATION.md section 4, serving pin).

CPU-only weight arithmetic; run with nothing else memory-heavy resident.
Output: a merged bf16 model directory ready for GGUF conversion.

Usage:
    python program2-merge-adapter.py --variant instruct \
        --adapter ~/.machinespirits-data/program-2/adapters/out-sft-instruct/final \
        --out ~/.machinespirits-data/program-2/merged/sft-instruct
"""

import argparse

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

FROZEN = {
    "instruct": {"model": "Qwen/Qwen3.5-9B", "revision": "c202236235762e1c871ad0ccb60c8ee5ba337b9a"},
    "base": {"model": "Qwen/Qwen3.5-9B-Base", "revision": "68c46c4b3498877f3ef123c856ecfde50c39f404"},
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=["instruct", "base"], required=True)
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    frozen = FROZEN[args.variant]

    model = AutoModelForCausalLM.from_pretrained(
        frozen["model"],
        revision=frozen["revision"],
        torch_dtype=torch.bfloat16,
        device_map="cpu",
        low_cpu_mem_usage=True,
    )
    model = PeftModel.from_pretrained(model, args.adapter)
    model = model.merge_and_unload()
    model.save_pretrained(args.out)
    AutoTokenizer.from_pretrained(frozen["model"], revision=frozen["revision"]).save_pretrained(args.out)
    print(f"merged -> {args.out}")


if __name__ == "__main__":
    main()
