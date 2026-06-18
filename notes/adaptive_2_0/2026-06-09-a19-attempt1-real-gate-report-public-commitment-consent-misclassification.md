{
  "status": "fail",
  "empirical_status": "real_attempt1_blocked",
  "created_at": "2026-06-09T15:00:55.092Z",
  "protocol_id": "A19",
  "protocol_version": "a19-drama-axiom-transfer-v0.9",
  "source_config": "config/teaching-drama-axioms/pilot-families.yaml",
  "source_out_dir": "exports/a19/real-attempt1-v16",
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
      "config_sha256": "df5779986c97d8de4d0753cf5e75bd3144571c952950a466dcdb87fd6599a446",
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
        "family_id": "public_commitment_consent_misclassification_ledger",
        "issues": [],
        "cards": [
          {
            "sibling_id": "public_commitment_consent_misclassification_ledger_a",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "commitment_ledger_repair",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "public_commitment_consent_misclassification_ledger_b",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "commitment_ledger_repair",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "public_commitment_consent_misclassification_ledger_c",
            "verdict": "ceiling",
            "expected": "ceiling",
            "protocol_reject_reason": null,
            "repair_type": "commitment_ledger_repair",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          }
        ]
      }
    ],
    "cards": [
      {
        "family_id": "public_commitment_consent_misclassification_ledger",
        "sibling_id": "public_commitment_consent_misclassification_ledger_a",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "commitment_ledger_repair",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "public_commitment_consent_misclassification_ledger",
        "sibling_id": "public_commitment_consent_misclassification_ledger_b",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "commitment_ledger_repair",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "public_commitment_consent_misclassification_ledger",
        "sibling_id": "public_commitment_consent_misclassification_ledger_c",
        "verdict": "ceiling",
        "expected": "ceiling",
        "protocol_reject_reason": null,
        "repair_type": "commitment_ledger_repair",
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
      "family_id": "public_commitment_consent_misclassification_ledger",
      "training_seed_id": "public_commitment_consent_misclassification_ledger_seed",
      "expected_failure": "failure_to_repair_rupture",
      "old_rule_decoy": "treat_comparison_question_as_consent_to_choose",
      "target_policy_id": "consent_boundary_ledger_before_claim_choice",
      "status": "blocked",
      "next_gate": "stop_before_s0s1",
      "mock_only": false,
      "generator_backend": "codex",
      "checker_backend": "claude",
      "manifest_path": "exports/a19/real-attempt1-v16/public-commitment-consent-misclassification-ledger/manifest.json",
      "revised_public_path": "exports/a19/real-attempt1-v16/public-commitment-consent-misclassification-ledger/attempt1.full/revised-public.txt",
      "revision_json_path": "exports/a19/real-attempt1-v16/public-commitment-consent-misclassification-ledger/attempt1.full/revision.json",
      "check_json_path": "exports/a19/real-attempt1-v16/public-commitment-consent-misclassification-ledger/attempt1.full/check.json",
      "gate_status": "revise_again",
      "recommended_action": "revise_again",
      "prompt_hashes": {
        "generator": {
          "system": "c31277923adb8f47",
          "user": "eefe3f2e8bb7070a"
        },
        "checker": {
          "system": "cf74188b843977b0",
          "user": "fb8a8ef39e76b0c0"
        }
      },
      "scores": {
        "old_warrant_misclassification": 0.65,
        "resistance_diagnosis": 0.45,
        "strategy_revision_accountability": 0.62,
        "recursive_dyadic_update": 0.45,
        "non_leakage": 0.95
      },
      "blockers": [
        {
          "field": "old_warrant_misclassification",
          "threshold": 0.7,
          "value": 0.65,
          "reason": "below_threshold"
        },
        {
          "field": "resistance_diagnosis",
          "threshold": 0.7,
          "value": 0.45,
          "reason": "below_threshold"
        },
        {
          "field": "strategy_revision_accountability",
          "threshold": 0.7,
          "value": 0.62,
          "reason": "below_threshold"
        },
        {
          "field": "recursive_dyadic_update",
          "threshold": 0.7,
          "value": 0.45,
          "reason": "below_threshold"
        },
        {
          "reason": "a18_replay_gate_not_survivor",
          "gate_status": "revise_again"
        },
        {
          "reason": "checker_recommended_stop",
          "recommended_action": "revise_again"
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
