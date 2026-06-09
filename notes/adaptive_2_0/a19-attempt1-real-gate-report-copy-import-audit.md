{
  "status": "pass",
  "empirical_status": "real_attempt1_present",
  "created_at": "2026-06-09T13:10:11.577Z",
  "protocol_id": "A19",
  "protocol_version": "a19-drama-axiom-transfer-v0.9",
  "source_config": "config/teaching-drama-axioms/pilot-families.yaml",
  "source_out_dir": "exports/a19/real-attempt1-v10",
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
      "config_sha256": "6f6d9358c03e8d5d5eca870716382d4c0922da1589277497a65c79b3a569baa7",
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
        "family_id": "over_compliance_copy_import_audit",
        "issues": [],
        "cards": [
          {
            "sibling_id": "over_compliance_copy_import_audit_a",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "preserve_struggle",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "over_compliance_copy_import_audit_b",
            "verdict": "policy_headroom",
            "expected": "policy_headroom",
            "protocol_reject_reason": null,
            "repair_type": "preserve_struggle",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          },
          {
            "sibling_id": "over_compliance_copy_import_audit_c",
            "verdict": "ceiling",
            "expected": "ceiling",
            "protocol_reject_reason": null,
            "repair_type": "preserve_struggle",
            "repair_subtype": null,
            "s0_baseline_stratum": "recursive_full_no_policy_memory"
          }
        ]
      }
    ],
    "cards": [
      {
        "family_id": "over_compliance_copy_import_audit",
        "sibling_id": "over_compliance_copy_import_audit_a",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "preserve_struggle",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "over_compliance_copy_import_audit",
        "sibling_id": "over_compliance_copy_import_audit_b",
        "verdict": "policy_headroom",
        "expected": "policy_headroom",
        "protocol_reject_reason": null,
        "repair_type": "preserve_struggle",
        "repair_subtype": null,
        "s0_baseline_stratum": "recursive_full_no_policy_memory"
      },
      {
        "family_id": "over_compliance_copy_import_audit",
        "sibling_id": "over_compliance_copy_import_audit_c",
        "verdict": "ceiling",
        "expected": "ceiling",
        "protocol_reject_reason": null,
        "repair_type": "preserve_struggle",
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
      "family_id": "over_compliance_copy_import_audit",
      "training_seed_id": "over_compliance_copy_import_audit_seed",
      "expected_failure": "copy_imports_unowned_claim",
      "old_rule_decoy": "supply_copyable_template_to_keep_momentum",
      "target_policy_id": "audit_borrowed_claims_then_return_choice",
      "status": "survivor",
      "next_gate": "eligible_for_s0s1_contrast",
      "mock_only": false,
      "generator_backend": "codex",
      "checker_backend": "claude",
      "manifest_path": "exports/a19/real-attempt1-v10/over-compliance-copy-import-audit/manifest.json",
      "revised_public_path": "exports/a19/real-attempt1-v10/over-compliance-copy-import-audit/attempt1.full/revised-public.txt",
      "revision_json_path": "exports/a19/real-attempt1-v10/over-compliance-copy-import-audit/attempt1.full/revision.json",
      "check_json_path": "exports/a19/real-attempt1-v10/over-compliance-copy-import-audit/attempt1.full/check.json",
      "gate_status": "survivor",
      "recommended_action": "accept_for_blind_panel",
      "prompt_hashes": {
        "generator": {
          "system": "c31277923adb8f47",
          "user": "a1b80e524d022901"
        },
        "checker": {
          "system": "cf74188b843977b0",
          "user": "4d127b16c117d71c"
        }
      },
      "scores": {
        "old_warrant_misclassification": 0.8,
        "resistance_diagnosis": 0.7,
        "strategy_revision_accountability": 0.8,
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
