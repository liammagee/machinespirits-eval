#!/usr/bin/env python3
"""Program-2 frozen conditional KTO run (PROGRAM-2-PHASE2-PREREGISTRATION.md
sections 2-3).

Licensed ONLY for a variant whose SFT run failed the primary gates; starts
from that variant's SFT adapter. Unpaired desirable/undesirable audit labels
(the plan prohibits DPO pairs through the repair channel). One run per
variant. Frozen values; changing any re-opens the freeze.

Usage:
    python program2-train-kto.py --variant instruct --from-adapter out-sft-instruct/final --data-dir data
"""

import argparse

from datasets import load_dataset
from peft import PeftModel
from transformers import AutoModelForImageTextToText, AutoTokenizer
from trl import KTOConfig, KTOTrainer

FROZEN = {
    "instruct": {"model": "Qwen/Qwen3.5-9B", "revision": "c202236235762e1c871ad0ccb60c8ee5ba337b9a"},
    "base": {"model": "Qwen/Qwen3.5-9B-Base", "revision": "68c46c4b3498877f3ef123c856ecfde50c39f404"},
}
SEED = 20260718


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=["instruct", "base"], required=True)
    parser.add_argument("--from-adapter", required=True)
    parser.add_argument("--data-dir", default="data")
    args = parser.parse_args()
    frozen = FROZEN[args.variant]

    tokenizer = AutoTokenizer.from_pretrained(frozen["model"], revision=frozen["revision"])
    # Forced correction (2026-07-21, first real KTO execution): the SFT
    # adapters carry the VLM-class module tree (model.language_model.*), so
    # the base MUST load through the same class the verified merge uses —
    # AutoModelForCausalLM would silently attach fresh zero adapters (the
    # documented Phase 4 no-op-merge failure). Assert a trained lora_B is
    # nonzero after loading: zero-init attach means key mismatch.
    model = AutoModelForImageTextToText.from_pretrained(
        frozen["model"], revision=frozen["revision"], torch_dtype="bfloat16"
    )
    model = PeftModel.from_pretrained(model, args.from_adapter, is_trainable=True)
    loaded_b = [
        p.detach().abs().max().item()
        for name, p in model.named_parameters()
        if "lora_B" in name and "language_model" in name
    ]
    assert loaded_b and max(loaded_b) > 0, "SFT adapter did not load (zero lora_B — module-tree key mismatch)"
    print(f"adapter load verified: {len(loaded_b)} language_model lora_B tensors, max |w| = {max(loaded_b):.6f}")

    data = load_dataset("json", data_files={"train": f"{args.data_dir}/kto.jsonl"})

    trainer = KTOTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=data["train"],
        args=KTOConfig(
            output_dir=f"out-kto-{args.variant}",
            num_train_epochs=1,
            # Forced correction (2026-07-21): TRL refuses KTO at actual batch
            # size 1 (the KL estimate degenerates). 4 x 2 preserves the frozen
            # effective batch of 8; lr, epochs, seed, data unchanged.
            per_device_train_batch_size=4,
            gradient_accumulation_steps=2,
            learning_rate=5e-6,
            bf16=True,
            save_strategy="epoch",
            logging_steps=10,
            seed=SEED,
        ),
    )
    trainer.train()
    trainer.save_model(f"out-kto-{args.variant}/final")


if __name__ == "__main__":
    main()
