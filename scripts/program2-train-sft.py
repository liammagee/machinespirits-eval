#!/usr/bin/env python3
"""Program-2 frozen SFT run (PROGRAM-2-PHASE2-PREREGISTRATION.md section 2).

Runs on the Lambda box (runbook section 4). One run per variant is licensed;
every training-relevant value below is frozen by the pre-registration —
changing any of them re-opens the freeze.

Usage:
    python program2-train-sft.py --variant instruct --data-dir data
    python program2-train-sft.py --variant base --data-dir data
    python program2-train-sft.py --variant instruct --smoke   # 20-step stack proof
"""

import argparse

from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

FROZEN = {
    "instruct": {
        "model": "Qwen/Qwen3.5-9B",
        "revision": "c202236235762e1c871ad0ccb60c8ee5ba337b9a",
        "data": "sft-instruct.jsonl",
    },
    "base": {
        "model": "Qwen/Qwen3.5-9B-Base",
        "revision": "68c46c4b3498877f3ef123c856ecfde50c39f404",
        "data": "sft-base.jsonl",
    },
}
SEED = 20260718


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=["instruct", "base"], required=True)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--smoke", action="store_true", help="20-step stack proof, not a licensed run")
    args = parser.parse_args()
    frozen = FROZEN[args.variant]

    data = load_dataset("json", data_files={"train": f"{args.data_dir}/{frozen['data']}"})

    config = SFTConfig(
        output_dir=f"out-sft-{args.variant}" + ("-smoke" if args.smoke else ""),
        num_train_epochs=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=1e-4,
        bf16=True,
        completion_only_loss=True,
        save_strategy="epoch",
        logging_steps=10,
        seed=SEED,
        model_init_kwargs={"revision": frozen["revision"]},
    )
    if args.smoke:
        config.max_steps = 20
        config.save_strategy = "no"

    trainer = SFTTrainer(
        model=frozen["model"],
        train_dataset=data["train"],
        peft_config=LoraConfig(r=32, lora_alpha=64, target_modules="all-linear"),
        args=config,
    )
    trainer.train()
    if not args.smoke:
        trainer.save_model(config.output_dir + "/final")


if __name__ == "__main__":
    main()
