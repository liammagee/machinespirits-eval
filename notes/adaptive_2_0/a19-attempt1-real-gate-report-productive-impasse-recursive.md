{
  "status": "fail",
  "empirical_status": "real_attempt1_blocked",
  "created_at": "2026-06-09T14:15:32.516Z",
  "protocol_id": "A19",
  "protocol_version": "a19-drama-axiom-transfer-v0.9",
  "source_config": "config/teaching-drama-axioms/pilot-families.yaml",
  "source_out_dir": "exports/a19/real-attempt1-v11",
  "source_attempt1_dirs": {},
  "thresholds": {
    "old_warrant_misclassification": 0.7,
    "resistance_diagnosis": 0.7,
    "strategy_revision_accountability": 0.7,
    "recursive_dyadic_update": 0.7,
    "non_leakage": 0.9
  },
  "validation": {
    "status": "pass",
    "protocol_id": "A19",
    "protocol_version": "a19-drama-axiom-transfer-v0.9",
    "family_schema_version": "teaching-drama-axiom-families-v0.1",
    "provenance": {
      "protocol_path": "config/teaching-drama-axioms/a19-protocol.yaml",
      "protocol_sha256": "25b5fbba96eff2f13e561fd8296b43b5b66396a9b7da414932f0088382bd8983",
      "config_path": "config/teaching-drama-axioms/pilot-families.yaml",
      "config_sha256": "51bf42b34a4c930fff9470d93e87bd6da12bcf9b01771aa0d2bea70bf6a7ff1b",
      "validator": "scripts/validate-teaching-drama-axiom-protocol.js",
      "zero_api": true
    },
    "summary": {
      "errors": 0,
      "warnings": 0,
      "families": 1,
      "cards": 3,
      "verdict_counts": {
        "policy_headroom": 2,
        "ceiling": 1
      }
    },
    "issues": [],
    "families": [
      {
        "family_id": "productive_impasse_diagnostic_options_recursive",
        "issues": [],
        "cards": [
          {
            "sibling_id": "productive_impasse_diagnostic_options_recursive_a",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "offer_diagnostic_options",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "productive_impasse_diagnostic_options_recursive_b",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "offer_diagnostic_options",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "productive_impasse_diagnostic_options_recursive_c",
            "verdict": "ceiling",
            "expected": "ceiling",
            "protocol_reject_reason": null,
            "repair_type": "offer_diagnostic_options",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          }
        ]
      }
    ],
    "cards": [
      {
        "family_id": "productive_impasse_diagnostic_options_recursive",
        "sibling_id": "productive_impasse_diagnostic_options_recursive_a",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "offer_diagnostic_options",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "productive_impasse_diagnostic_options_recursive",
        "sibling_id": "productive_impasse_diagnostic_options_recursive_b",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "offer_diagnostic_options",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "productive_impasse_diagnostic_options_recursive",
        "sibling_id": "productive_impasse_diagnostic_options_recursive_c",
        "verdict": "ceiling",
        "expected": "ceiling",
        "protocol_reject_reason": null,
        "repair_type": "offer_diagnostic_options",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      }
    ],
    "non_claims": [
      "human_learning",
      "deployed_adaptive_tutor",
      "model_weight_learning",
      "main_harness_rate_effect"
    ]
  },
  "summary": {
    "families": 1,
    "survivors": 0,
    "fixture_survivors": 0,
    "blocked": 1,
    "missing_attempt1_replay": 0
  },
  "families": [
    {
      "family_id": "productive_impasse_diagnostic_options_recursive",
      "training_seed_id": "productive_impasse_diagnostic_options_recursive_seed",
      "expected_failure": "answer_leakage",
      "old_rule_decoy": "give_full_answer_to_reduce_frustration",
      "target_policy_id": "offer_diagnostic_options_before_answer",
      "status": "blocked",
      "next_gate": "stop_before_s0s1",
      "mock_only": false,
      "generator_backend": "codex",
      "checker_backend": "claude",
      "manifest_path": "exports/a19/real-attempt1-v11/productive-impasse-diagnostic-options-recursive/manifest.json",
      "revised_public_path": "exports/a19/real-attempt1-v11/productive-impasse-diagnostic-options-recursive/attempt1.full/revised-public.txt",
      "revision_json_path": "exports/a19/real-attempt1-v11/productive-impasse-diagnostic-options-recursive/attempt1.full/revision.json",
      "check_json_path": "exports/a19/real-attempt1-v11/productive-impasse-diagnostic-options-recursive/attempt1.full/check.json",
      "gate_status": "reject",
      "recommended_action": "accept_for_blind_panel",
      "prompt_hashes": {
        "generator": {
          "system": "c31277923adb8f47",
          "user": "1ab915514c0fe058"
        },
        "checker": {
          "system": "cf74188b843977b0",
          "user": "a0f4af3f403f165f"
        }
      },
      "scores": {
        "old_warrant_misclassification": 0.85,
        "resistance_diagnosis": 0.8,
        "strategy_revision_accountability": 0.8,
        "recursive_dyadic_update": 0.78,
        "non_leakage": 0.82
      },
      "blockers": [
        {
          "field": "non_leakage",
          "threshold": 0.9,
          "value": 0.82,
          "reason": "below_threshold"
        },
        {
          "reason": "a18_replay_gate_not_survivor",
          "gate_status": "reject"
        }
      ]
    }
  ],
  "non_claims": [
    "human_learning",
    "deployed_adaptive_tutor",
    "model_weight_learning",
    "main_harness_rate_effect",
    "paid_blind_panel_result"
  ]
}
