{
  "status": "fail",
  "empirical_status": "real_attempt1_blocked",
  "created_at": "2026-06-09T15:22:41.837Z",
  "protocol_id": "A19",
  "protocol_version": "a19-drama-axiom-transfer-v0.9",
  "source_config": "config/teaching-drama-axioms/pilot-families.yaml",
  "source_out_dir": "exports/a19/real-attempt1-v18",
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
      "config_sha256": "029c5b7c8432ae14999b538220c52a2b4e9cb4df20f61175323a3dfb07c85f07",
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
        "family_id": "claim_evidence_role_mismatch",
        "issues": [],
        "cards": [
          {
            "sibling_id": "claim_evidence_role_mismatch_a",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "name_warrant",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "claim_evidence_role_mismatch_b",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "name_warrant",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "claim_evidence_role_mismatch_c",
            "verdict": "ceiling",
            "expected": "ceiling",
            "protocol_reject_reason": null,
            "repair_type": "name_warrant",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          }
        ]
      }
    ],
    "cards": [
      {
        "family_id": "claim_evidence_role_mismatch",
        "sibling_id": "claim_evidence_role_mismatch_a",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "name_warrant",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "claim_evidence_role_mismatch",
        "sibling_id": "claim_evidence_role_mismatch_b",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "name_warrant",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "claim_evidence_role_mismatch",
        "sibling_id": "claim_evidence_role_mismatch_c",
        "verdict": "ceiling",
        "expected": "ceiling",
        "protocol_reject_reason": null,
        "repair_type": "name_warrant",
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
      "family_id": "claim_evidence_role_mismatch",
      "training_seed_id": "claim_evidence_role_mismatch_seed",
      "expected_failure": "validation_without_engagement",
      "old_rule_decoy": "choose_claim_with_most_concrete_facts",
      "target_policy_id": "evidence_role_match_before_claim_selection",
      "status": "blocked",
      "next_gate": "stop_before_s0s1",
      "mock_only": false,
      "generator_backend": "codex",
      "checker_backend": "claude",
      "manifest_path": "exports/a19/real-attempt1-v18/claim-evidence-role-mismatch/manifest.json",
      "revised_public_path": "exports/a19/real-attempt1-v18/claim-evidence-role-mismatch/attempt1.full/revised-public.txt",
      "revision_json_path": "exports/a19/real-attempt1-v18/claim-evidence-role-mismatch/attempt1.full/revision.json",
      "check_json_path": "exports/a19/real-attempt1-v18/claim-evidence-role-mismatch/attempt1.full/check.json",
      "gate_status": "reject",
      "recommended_action": "accept_for_blind_panel",
      "prompt_hashes": {
        "generator": {
          "system": "c31277923adb8f47",
          "user": "6b54f35859b3d088"
        },
        "checker": {
          "system": "cf74188b843977b0",
          "user": "be7ce54408d8b0d3"
        }
      },
      "scores": {
        "old_warrant_misclassification": 0.78,
        "resistance_diagnosis": 0.6,
        "strategy_revision_accountability": 0.8,
        "recursive_dyadic_update": 0.6,
        "non_leakage": 0.88
      },
      "blockers": [
        {
          "field": "resistance_diagnosis",
          "threshold": 0.7,
          "value": 0.6,
          "reason": "below_threshold"
        },
        {
          "field": "recursive_dyadic_update",
          "threshold": 0.7,
          "value": 0.6,
          "reason": "below_threshold"
        },
        {
          "field": "non_leakage",
          "threshold": 0.9,
          "value": 0.88,
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
