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
from transformers import AutoModelForCausalLM, AutoTokenizer
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
    model = AutoModelForCausalLM.from_pretrained(
        frozen["model"], revision=frozen["revision"], torch_dtype="bfloat16"
    )
    model = PeftModel.from_pretrained(model, args.from_adapter, is_trainable=True)

    data = load_dataset("json", data_files={"train": f"{args.data_dir}/kto.jsonl"})

    trainer = KTOTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=data["train"],
        args=KTOConfig(
            output_dir=f"out-kto-{args.variant}",
            num_train_epochs=1,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
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
