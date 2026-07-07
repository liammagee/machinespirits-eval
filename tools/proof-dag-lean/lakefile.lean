import Lake
open Lake DSL

package proof_dag_lean where
  -- Optional proof-DAG certificate package. Keep dependency-free unless a
  -- certificate genuinely needs more than Lean core.

@[default_target]
lean_lib ProofDag where
  srcDir := "."
