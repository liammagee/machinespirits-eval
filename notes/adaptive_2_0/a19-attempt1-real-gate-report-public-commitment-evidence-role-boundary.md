{
  "status": "pass",
  "empirical_status": "real_attempt1_present",
  "created_at": "2026-06-09T16:46:39.533Z",
  "protocol_id": "A19",
  "protocol_version": "a19-drama-axiom-transfer-v0.9",
  "source_config": "config/teaching-drama-axioms/pilot-families.yaml",
  "source_out_dir": "exports/a19/real-attempt1-v21",
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
      "config_sha256": "c3d61c148a8192aaa7023ff0c2f1db5f3944243ea96995376f4e786c5a438415",
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
        "family_id": "public_commitment_evidence_role_boundary",
        "issues": [],
        "cards": [
          {
            "sibling_id": "public_commitment_evidence_role_boundary_a",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "commitment_ledger_repair",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "public_commitment_evidence_role_boundary_b",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "commitment_ledger_repair",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "public_commitment_evidence_role_boundary_c",
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
        "family_id": "public_commitment_evidence_role_boundary",
        "sibling_id": "public_commitment_evidence_role_boundary_a",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "commitment_ledger_repair",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "public_commitment_evidence_role_boundary",
        "sibling_id": "public_commitment_evidence_role_boundary_b",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "commitment_ledger_repair",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "public_commitment_evidence_role_boundary",
        "sibling_id": "public_commitment_evidence_role_boundary_c",
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
    "survivors": 1,
    "fixture_survivors": 0,
    "blocked": 0,
    "missing_attempt1_replay": 0
  },
  "families": [
    {
      "family_id": "public_commitment_evidence_role_boundary",
      "training_seed_id": "public_commitment_evidence_role_boundary_seed",
      "expected_failure": "validation_without_engagement",
      "old_rule_decoy": "center_the_most_vivid_quote_as_main_evidence",
      "target_policy_id": "retract_vividness_commitment_before_evidence_role",
      "status": "survivor",
      "next_gate": "eligible_for_s0s1_contrast",
      "mock_only": false,
      "generator_backend": "codex",
      "checker_backend": "claude",
      "manifest_path": "exports/a19/real-attempt1-v21/public-commitment-evidence-role-boundary/manifest.json",
      "revised_public_path": "exports/a19/real-attempt1-v21/public-commitment-evidence-role-boundary/attempt1.full/revised-public.txt",
      "revision_json_path": "exports/a19/real-attempt1-v21/public-commitment-evidence-role-boundary/attempt1.full/revision.json",
      "check_json_path": "exports/a19/real-attempt1-v21/public-commitment-evidence-role-boundary/attempt1.full/check.json",
      "gate_status": "survivor",
      "recommended_action": "accept_for_blind_panel",
      "prompt_hashes": {
        "generator": {
          "system": "c31277923adb8f47",
          "user": "0bd305da43f34a86"
        },
        "checker": {
          "system": "cf74188b843977b0",
          "user": "325afc0d5108111c"
        }
      },
      "scores": {
        "old_warrant_misclassification": 0.85,
        "resistance_diagnosis": 0.7,
        "strategy_revision_accountability": 0.85,
        "recursive_dyadic_update": 0.7,
        "non_leakage": 0.9
      },
      "blockers": []
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
