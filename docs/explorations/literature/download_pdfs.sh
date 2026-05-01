#!/usr/bin/env bash
# Download all arXiv PDFs from research-resources.md into per-section folders.
# Run from anywhere; PDFs land relative to this script's directory.
# Usage: bash download_pdfs.sh
#
# Auto-generated. Re-run safely: existing files are skipped.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p pdfs

UA="Mozilla/5.0 (research-bibliography-downloader)"
fail=0
ok=0
skip=0

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/1506.05908_deep-knowledge-tracing.pdf" ]]; then echo "SKIP 1506.05908"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/1506.05908_deep-knowledge-tracing.pdf" "https://arxiv.org/pdf/1506.05908"; then echo "OK   1506.05908"; ok=$((ok+1));
else echo "FAIL 1506.05908 https://arxiv.org/pdf/1506.05908"; rm -f "pdfs/01-knowledge-tracing/1506.05908_deep-knowledge-tracing.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2409.16490_exploring-knowledge-tracing-in-tutor-student-dialogues-using-llms.pdf" ]]; then echo "SKIP 2409.16490"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2409.16490_exploring-knowledge-tracing-in-tutor-student-dialogues-using-llms.pdf" "https://arxiv.org/pdf/2409.16490"; then echo "OK   2409.16490"; ok=$((ok+1));
else echo "FAIL 2409.16490 https://arxiv.org/pdf/2409.16490"; rm -f "pdfs/01-knowledge-tracing/2409.16490_exploring-knowledge-tracing-in-tutor-student-dialogues-using-llms.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2503.06424_training-llm-based-tutors-to-improve-student-learning-outcomes-in-dialogues.pdf" ]]; then echo "SKIP 2503.06424"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2503.06424_training-llm-based-tutors-to-improve-student-learning-outcomes-in-dialogues.pdf" "https://arxiv.org/pdf/2503.06424"; then echo "OK   2503.06424"; ok=$((ok+1));
else echo "FAIL 2503.06424 https://arxiv.org/pdf/2503.06424"; rm -f "pdfs/01-knowledge-tracing/2503.06424_training-llm-based-tutors-to-improve-student-learning-outcomes-in-dialogues.pdf"; fail=$((fail+1)); fi
sleep 0.5

# 2502.19915 (Cen et al. 2025, Dual-channel Difficulty KT) was WITHDRAWN by authors for data correction.
# Try v1 PDF first; if also gone, save the HTML version as a fallback so the content isn't lost.
mkdir -p "pdfs/01-knowledge-tracing"
target_2502_19915="pdfs/01-knowledge-tracing/2502.19915_llm-driven-effective-knowledge-tracing-by-integrating-dual-channel-difficulty"
if [[ -s "${target_2502_19915}.pdf" ]] || [[ -s "${target_2502_19915}.html" ]]; then echo "SKIP 2502.19915 (withdrawn — fallback already present)"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "${target_2502_19915}.pdf" "https://arxiv.org/pdf/2502.19915v1"; then echo "OK   2502.19915 (v1 — withdrawn paper, recovered)"; ok=$((ok+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "${target_2502_19915}.html" "https://arxiv.org/html/2502.19915v1"; then echo "OK   2502.19915 (HTML fallback — paper withdrawn, PDF unavailable)"; ok=$((ok+1));
else echo "FAIL 2502.19915 (paper withdrawn by authors — no PDF or HTML available; see arxiv.org/abs/2502.19915)"; rm -f "${target_2502_19915}.pdf" "${target_2502_19915}.html"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2505.17705_cikt-collaborative-iterative-knowledge-tracing.pdf" ]]; then echo "SKIP 2505.17705"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2505.17705_cikt-collaborative-iterative-knowledge-tracing.pdf" "https://arxiv.org/pdf/2505.17705"; then echo "OK   2505.17705"; ok=$((ok+1));
else echo "FAIL 2505.17705 https://arxiv.org/pdf/2505.17705"; rm -f "pdfs/01-knowledge-tracing/2505.17705_cikt-collaborative-iterative-knowledge-tracing.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2511.02599_next-token-knowledge-tracing-ntkt-2025.pdf" ]]; then echo "SKIP 2511.02599"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2511.02599_next-token-knowledge-tracing-ntkt-2025.pdf" "https://arxiv.org/pdf/2511.02599"; then echo "OK   2511.02599"; ok=$((ok+1));
else echo "FAIL 2511.02599 https://arxiv.org/pdf/2511.02599"; rm -f "pdfs/01-knowledge-tracing/2511.02599_next-token-knowledge-tracing-ntkt-2025.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2506.16982_language-bottleneck-models-for-qualitative-knowledge-state-modeling.pdf" ]]; then echo "SKIP 2506.16982"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2506.16982_language-bottleneck-models-for-qualitative-knowledge-state-modeling.pdf" "https://arxiv.org/pdf/2506.16982"; then echo "OK   2506.16982"; ok=$((ok+1));
else echo "FAIL 2506.16982 https://arxiv.org/pdf/2506.16982"; rm -f "pdfs/01-knowledge-tracing/2506.16982_language-bottleneck-models-for-qualitative-knowledge-state-modeling.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2602.22879_l-hakt-llm-empowered-knowledge-tracing-via-hierarchical-behavior-alignment-in-hy.pdf" ]]; then echo "SKIP 2602.22879"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2602.22879_l-hakt-llm-empowered-knowledge-tracing-via-hierarchical-behavior-alignment-in-hy.pdf" "https://arxiv.org/pdf/2602.22879"; then echo "OK   2602.22879"; ok=$((ok+1));
else echo "FAIL 2602.22879 https://arxiv.org/pdf/2602.22879"; rm -f "pdfs/01-knowledge-tracing/2602.22879_l-hakt-llm-empowered-knowledge-tracing-via-hierarchical-behavior-alignment-in-hy.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2603.04855_hachimi-scalable-and-controllable-student-persona-generation-via-orchestrated-ag.pdf" ]]; then echo "SKIP 2603.04855"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2603.04855_hachimi-scalable-and-controllable-student-persona-generation-via-orchestrated-ag.pdf" "https://arxiv.org/pdf/2603.04855"; then echo "OK   2603.04855"; ok=$((ok+1));
else echo "FAIL 2603.04855 https://arxiv.org/pdf/2603.04855"; rm -f "pdfs/01-knowledge-tracing/2603.04855_hachimi-scalable-and-controllable-student-persona-generation-via-orchestrated-ag.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2601.05473_towards-valid-student-simulation-with-large-language-models.pdf" ]]; then echo "SKIP 2601.05473"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2601.05473_towards-valid-student-simulation-with-large-language-models.pdf" "https://arxiv.org/pdf/2601.05473"; then echo "OK   2601.05473"; ok=$((ok+1));
else echo "FAIL 2601.05473 https://arxiv.org/pdf/2601.05473"; rm -f "pdfs/01-knowledge-tracing/2601.05473_towards-valid-student-simulation-with-large-language-models.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2511.06078_simulating-students-with-large-language-models-a-review-of-architecture.pdf" ]]; then echo "SKIP 2511.06078"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2511.06078_simulating-students-with-large-language-models-a-review-of-architecture.pdf" "https://arxiv.org/pdf/2511.06078"; then echo "OK   2511.06078"; ok=$((ok+1));
else echo "FAIL 2511.06078 https://arxiv.org/pdf/2511.06078"; rm -f "pdfs/01-knowledge-tracing/2511.06078_simulating-students-with-large-language-models-a-review-of-architecture.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2504.06460_can-llms-simulate-personas-with-reversed-performance.pdf" ]]; then echo "SKIP 2504.06460"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2504.06460_can-llms-simulate-personas-with-reversed-performance.pdf" "https://arxiv.org/pdf/2504.06460"; then echo "OK   2504.06460"; ok=$((ok+1));
else echo "FAIL 2504.06460 https://arxiv.org/pdf/2504.06460"; rm -f "pdfs/01-knowledge-tracing/2504.06460_can-llms-simulate-personas-with-reversed-performance.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2105.15106_a-survey-of-knowledge-tracing-models-variants-and-applications.pdf" ]]; then echo "SKIP 2105.15106"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2105.15106_a-survey-of-knowledge-tracing-models-variants-and-applications.pdf" "https://arxiv.org/pdf/2105.15106"; then echo "OK   2105.15106"; ok=$((ok+1));
else echo "FAIL 2105.15106 https://arxiv.org/pdf/2105.15106"; rm -f "pdfs/01-knowledge-tracing/2105.15106_a-survey-of-knowledge-tracing-models-variants-and-applications.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2007.12324_akt-context-aware-attentive-knowledge-tracing-ghosh-heffernan-lan-2020.pdf" ]]; then echo "SKIP 2007.12324"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2007.12324_akt-context-aware-attentive-knowledge-tracing-ghosh-heffernan-lan-2020.pdf" "https://arxiv.org/pdf/2007.12324"; then echo "OK   2007.12324"; ok=$((ok+1));
else echo "FAIL 2007.12324 https://arxiv.org/pdf/2007.12324"; rm -f "pdfs/01-knowledge-tracing/2007.12324_akt-context-aware-attentive-knowledge-tracing-ghosh-heffernan-lan-2020.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2010.12042_saint-shin-et-al-2020.pdf" ]]; then echo "SKIP 2010.12042"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2010.12042_saint-shin-et-al-2020.pdf" "https://arxiv.org/pdf/2010.12042"; then echo "OK   2010.12042"; ok=$((ok+1));
else echo "FAIL 2010.12042 https://arxiv.org/pdf/2010.12042"; rm -f "pdfs/01-knowledge-tracing/2010.12042_saint-shin-et-al-2020.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2501.05605_domain-knowledge-informed-attention-kt.pdf" ]]; then echo "SKIP 2501.05605"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2501.05605_domain-knowledge-informed-attention-kt.pdf" "https://arxiv.org/pdf/2501.05605"; then echo "OK   2501.05605"; ok=$((ok+1));
else echo "FAIL 2501.05605 https://arxiv.org/pdf/2501.05605"; rm -f "pdfs/01-knowledge-tracing/2501.05605_domain-knowledge-informed-attention-kt.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2105.00385_pybkt.pdf" ]]; then echo "SKIP 2105.00385"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2105.00385_pybkt.pdf" "https://arxiv.org/pdf/2105.00385"; then echo "OK   2105.00385"; ok=$((ok+1));
else echo "FAIL 2105.00385 https://arxiv.org/pdf/2105.00385"; rm -f "pdfs/01-knowledge-tracing/2105.00385_pybkt.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/1912.03072_ednet-choi-et-al-2019.pdf" ]]; then echo "SKIP 1912.03072"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/1912.03072_ednet-choi-et-al-2019.pdf" "https://arxiv.org/pdf/1912.03072"; then echo "OK   1912.03072"; ok=$((ok+1));
else echo "FAIL 1912.03072 https://arxiv.org/pdf/1912.03072"; rm -f "pdfs/01-knowledge-tracing/1912.03072_ednet-choi-et-al-2019.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2409.10244_es-kt-24.pdf" ]]; then echo "SKIP 2409.10244"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2409.10244_es-kt-24.pdf" "https://arxiv.org/pdf/2409.10244"; then echo "OK   2409.10244"; ok=$((ok+1));
else echo "FAIL 2409.10244 https://arxiv.org/pdf/2409.10244"; rm -f "pdfs/01-knowledge-tracing/2409.10244_es-kt-24.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/01-knowledge-tracing"
if [[ -s "pdfs/01-knowledge-tracing/2402.01580_gaied-workshop-series-neurips-2023-ijcai-2024-tutorial-ongoing.pdf" ]]; then echo "SKIP 2402.01580"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/01-knowledge-tracing/2402.01580_gaied-workshop-series-neurips-2023-ijcai-2024-tutorial-ongoing.pdf" "https://arxiv.org/pdf/2402.01580"; then echo "OK   2402.01580"; ok=$((ok+1));
else echo "FAIL 2402.01580 https://arxiv.org/pdf/2402.01580"; rm -f "pdfs/01-knowledge-tracing/2402.01580_gaied-workshop-series-neurips-2023-ijcai-2024-tutorial-ongoing.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/02-its-foundations"
if [[ -s "pdfs/02-its-foundations/2602.19303_the-path-to-conversational-ai-tutors-vanacore-closser-baker-roschelle-2026.pdf" ]]; then echo "SKIP 2602.19303"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/02-its-foundations/2602.19303_the-path-to-conversational-ai-tutors-vanacore-closser-baker-roschelle-2026.pdf" "https://arxiv.org/pdf/2602.19303"; then echo "OK   2602.19303"; ok=$((ok+1));
else echo "FAIL 2602.19303 https://arxiv.org/pdf/2602.19303"; rm -f "pdfs/02-its-foundations/2602.19303_the-path-to-conversational-ai-tutors-vanacore-closser-baker-roschelle-2026.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/02-its-foundations"
if [[ -s "pdfs/02-its-foundations/2508.01503_a-theory-of-adaptive-scaffolding-for-llm-based-pedagogical-agents.pdf" ]]; then echo "SKIP 2508.01503"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/02-its-foundations/2508.01503_a-theory-of-adaptive-scaffolding-for-llm-based-pedagogical-agents.pdf" "https://arxiv.org/pdf/2508.01503"; then echo "OK   2508.01503"; ok=$((ok+1));
else echo "FAIL 2508.01503 https://arxiv.org/pdf/2508.01503"; rm -f "pdfs/02-its-foundations/2508.01503_a-theory-of-adaptive-scaffolding-for-llm-based-pedagogical-agents.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/02-its-foundations"
if [[ -s "pdfs/02-its-foundations/2411.17924_ai2t-building-trustable-ai-tutors-by-interactively-teaching-a-self-aware-learnin.pdf" ]]; then echo "SKIP 2411.17924"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/02-its-foundations/2411.17924_ai2t-building-trustable-ai-tutors-by-interactively-teaching-a-self-aware-learnin.pdf" "https://arxiv.org/pdf/2411.17924"; then echo "OK   2411.17924"; ok=$((ok+1));
else echo "FAIL 2411.17924 https://arxiv.org/pdf/2411.17924"; rm -f "pdfs/02-its-foundations/2411.17924_ai2t-building-trustable-ai-tutors-by-interactively-teaching-a-self-aware-learnin.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2603.05778_tutor-move-taxonomy-zhou-vanacore-thompson-st-john-kizilcec-2026.pdf" ]]; then echo "SKIP 2603.05778"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2603.05778_tutor-move-taxonomy-zhou-vanacore-thompson-st-john-kizilcec-2026.pdf" "https://arxiv.org/pdf/2603.05778"; then echo "OK   2603.05778"; ok=$((ok+1));
else echo "FAIL 2603.05778 https://arxiv.org/pdf/2603.05778"; rm -f "pdfs/03-dialogue-acts/2603.05778_tutor-move-taxonomy-zhou-vanacore-thompson-st-john-kizilcec-2026.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2406.03486_biped-bilingual-pedagogically-informed-tutoring-dataset.pdf" ]]; then echo "SKIP 2406.03486"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2406.03486_biped-bilingual-pedagogically-informed-tutoring-dataset.pdf" "https://arxiv.org/pdf/2406.03486"; then echo "OK   2406.03486"; ok=$((ok+1));
else echo "FAIL 2406.03486 https://arxiv.org/pdf/2406.03486"; rm -f "pdfs/03-dialogue-acts/2406.03486_biped-bilingual-pedagogically-informed-tutoring-dataset.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2509.09125_automated-classification-of-tutors-dialogue-acts-using-generative-ai-a-case-stud.pdf" ]]; then echo "SKIP 2509.09125"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2509.09125_automated-classification-of-tutors-dialogue-acts-using-generative-ai-a-case-stud.pdf" "https://arxiv.org/pdf/2509.09125"; then echo "OK   2509.09125"; ok=$((ok+1));
else echo "FAIL 2509.09125 https://arxiv.org/pdf/2509.09125"; rm -f "pdfs/03-dialogue-acts/2509.09125_automated-classification-of-tutors-dialogue-acts-using-generative-ai-a-case-stud.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2506.17410_leveraging-llms-to-assess-tutor-moves-in-real-life-dialogues-a-feasibility-study.pdf" ]]; then echo "SKIP 2506.17410"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2506.17410_leveraging-llms-to-assess-tutor-moves-in-real-life-dialogues-a-feasibility-study.pdf" "https://arxiv.org/pdf/2506.17410"; then echo "OK   2506.17410"; ok=$((ok+1));
else echo "FAIL 2506.17410 https://arxiv.org/pdf/2506.17410"; rm -f "pdfs/03-dialogue-acts/2506.17410_leveraging-llms-to-assess-tutor-moves-in-real-life-dialogues-a-feasibility-study.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2412.13395_enhancing-talk-moves-analysis-in-mathematics-tutoring-through-classroom-teaching.pdf" ]]; then echo "SKIP 2412.13395"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2412.13395_enhancing-talk-moves-analysis-in-mathematics-tutoring-through-classroom-teaching.pdf" "https://arxiv.org/pdf/2412.13395"; then echo "OK   2412.13395"; ok=$((ok+1));
else echo "FAIL 2412.13395 https://arxiv.org/pdf/2412.13395"; rm -f "pdfs/03-dialogue-acts/2412.13395_enhancing-talk-moves-analysis-in-mathematics-tutoring-through-classroom-teaching.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2412.09416_unifying-ai-tutor-evaluation-an-evaluation-taxonomy-for-pedagogical-ability-asse.pdf" ]]; then echo "SKIP 2412.09416"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2412.09416_unifying-ai-tutor-evaluation-an-evaluation-taxonomy-for-pedagogical-ability-asse.pdf" "https://arxiv.org/pdf/2412.09416"; then echo "OK   2412.09416"; ok=$((ok+1));
else echo "FAIL 2412.09416 https://arxiv.org/pdf/2412.09416"; rm -f "pdfs/03-dialogue-acts/2412.09416_unifying-ai-tutor-evaluation-an-evaluation-taxonomy-for-pedagogical-ability-asse.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/03-dialogue-acts"
if [[ -s "pdfs/03-dialogue-acts/2204.09652_talkmoves-dataset-application.pdf" ]]; then echo "SKIP 2204.09652"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/03-dialogue-acts/2204.09652_talkmoves-dataset-application.pdf" "https://arxiv.org/pdf/2204.09652"; then echo "OK   2204.09652"; ok=$((ok+1));
else echo "FAIL 2204.09652 https://arxiv.org/pdf/2204.09652"; rm -f "pdfs/03-dialogue-acts/2204.09652_talkmoves-dataset-application.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/04-scaffolding"
if [[ -s "pdfs/04-scaffolding/2508.21204_fuzzy-symbolic-and-contextual-enhancing-llm-instruction-via-cognitive-scaffoldin.pdf" ]]; then echo "SKIP 2508.21204"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/04-scaffolding/2508.21204_fuzzy-symbolic-and-contextual-enhancing-llm-instruction-via-cognitive-scaffoldin.pdf" "https://arxiv.org/pdf/2508.21204"; then echo "OK   2508.21204"; ok=$((ok+1));
else echo "FAIL 2508.21204 https://arxiv.org/pdf/2508.21204"; rm -f "pdfs/04-scaffolding/2508.21204_fuzzy-symbolic-and-contextual-enhancing-llm-instruction-via-cognitive-scaffoldin.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/04-scaffolding"
if [[ -s "pdfs/04-scaffolding/2508.06754_a-fuzzy-logic-prompting-framework-for-large-language-models-in-adaptive-and-unce.pdf" ]]; then echo "SKIP 2508.06754"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/04-scaffolding/2508.06754_a-fuzzy-logic-prompting-framework-for-large-language-models-in-adaptive-and-unce.pdf" "https://arxiv.org/pdf/2508.06754"; then echo "OK   2508.06754"; ok=$((ok+1));
else echo "FAIL 2508.06754 https://arxiv.org/pdf/2508.06754"; rm -f "pdfs/04-scaffolding/2508.06754_a-fuzzy-logic-prompting-framework-for-large-language-models-in-adaptive-and-unce.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/04-scaffolding"
if [[ -s "pdfs/04-scaffolding/2506.19484_arxiv250619484-llms-and-vygotsky.pdf" ]]; then echo "SKIP 2506.19484"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/04-scaffolding/2506.19484_arxiv250619484-llms-and-vygotsky.pdf" "https://arxiv.org/pdf/2506.19484"; then echo "OK   2506.19484"; ok=$((ok+1));
else echo "FAIL 2506.19484 https://arxiv.org/pdf/2506.19484"; rm -f "pdfs/04-scaffolding/2506.19484_arxiv250619484-llms-and-vygotsky.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2210.03629_react-synergizing-reasoning-and-acting-in-language-models.pdf" ]]; then echo "SKIP 2210.03629"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2210.03629_react-synergizing-reasoning-and-acting-in-language-models.pdf" "https://arxiv.org/pdf/2210.03629"; then echo "OK   2210.03629"; ok=$((ok+1));
else echo "FAIL 2210.03629 https://arxiv.org/pdf/2210.03629"; rm -f "pdfs/05-llm-agents/2210.03629_react-synergizing-reasoning-and-acting-in-language-models.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2303.11366_reflexion-language-agents-with-verbal-reinforcement-learning.pdf" ]]; then echo "SKIP 2303.11366"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2303.11366_reflexion-language-agents-with-verbal-reinforcement-learning.pdf" "https://arxiv.org/pdf/2303.11366"; then echo "OK   2303.11366"; ok=$((ok+1));
else echo "FAIL 2303.11366 https://arxiv.org/pdf/2303.11366"; rm -f "pdfs/05-llm-agents/2303.11366_reflexion-language-agents-with-verbal-reinforcement-learning.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2305.16291_voyager-an-open-ended-embodied-agent-with-llms.pdf" ]]; then echo "SKIP 2305.16291"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2305.16291_voyager-an-open-ended-embodied-agent-with-llms.pdf" "https://arxiv.org/pdf/2305.16291"; then echo "OK   2305.16291"; ok=$((ok+1));
else echo "FAIL 2305.16291 https://arxiv.org/pdf/2305.16291"; rm -f "pdfs/05-llm-agents/2305.16291_voyager-an-open-ended-embodied-agent-with-llms.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2304.03442_generative-agents-interactive-simulacra-of-human-behavior.pdf" ]]; then echo "SKIP 2304.03442"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2304.03442_generative-agents-interactive-simulacra-of-human-behavior.pdf" "https://arxiv.org/pdf/2304.03442"; then echo "OK   2304.03442"; ok=$((ok+1));
else echo "FAIL 2304.03442 https://arxiv.org/pdf/2304.03442"; rm -f "pdfs/05-llm-agents/2304.03442_generative-agents-interactive-simulacra-of-human-behavior.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2601.12560_agentic-ai-architectures-taxonomies-and-evaluation-of-llm-agents.pdf" ]]; then echo "SKIP 2601.12560"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2601.12560_agentic-ai-architectures-taxonomies-and-evaluation-of-llm-agents.pdf" "https://arxiv.org/pdf/2601.12560"; then echo "OK   2601.12560"; ok=$((ok+1));
else echo "FAIL 2601.12560 https://arxiv.org/pdf/2601.12560"; rm -f "pdfs/05-llm-agents/2601.12560_agentic-ai-architectures-taxonomies-and-evaluation-of-llm-agents.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/05-llm-agents"
if [[ -s "pdfs/05-llm-agents/2601.01743_ai-agent-systems-architectures-applications-and-evaluation.pdf" ]]; then echo "SKIP 2601.01743"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/05-llm-agents/2601.01743_ai-agent-systems-architectures-applications-and-evaluation.pdf" "https://arxiv.org/pdf/2601.01743"; then echo "OK   2601.01743"; ok=$((ok+1));
else echo "FAIL 2601.01743 https://arxiv.org/pdf/2601.01743"; rm -f "pdfs/05-llm-agents/2601.01743_ai-agent-systems-architectures-applications-and-evaluation.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/06-counterfactual-eval"
if [[ -s "pdfs/06-counterfactual-eval/2502.11008_counterbench-tang-et-al-2025.pdf" ]]; then echo "SKIP 2502.11008"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/06-counterfactual-eval/2502.11008_counterbench-tang-et-al-2025.pdf" "https://arxiv.org/pdf/2502.11008"; then echo "OK   2502.11008"; ok=$((ok+1));
else echo "FAIL 2502.11008 https://arxiv.org/pdf/2502.11008"; rm -f "pdfs/06-counterfactual-eval/2502.11008_counterbench-tang-et-al-2025.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/06-counterfactual-eval"
if [[ -s "pdfs/06-counterfactual-eval/2410.21131_towards-unifying-evaluation-of-counterfactual-explanations-leveraging-llms-for-h.pdf" ]]; then echo "SKIP 2410.21131"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/06-counterfactual-eval/2410.21131_towards-unifying-evaluation-of-counterfactual-explanations-leveraging-llms-for-h.pdf" "https://arxiv.org/pdf/2410.21131"; then echo "OK   2410.21131"; ok=$((ok+1));
else echo "FAIL 2410.21131 https://arxiv.org/pdf/2410.21131"; rm -f "pdfs/06-counterfactual-eval/2410.21131_towards-unifying-evaluation-of-counterfactual-explanations-leveraging-llms-for-h.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/06-counterfactual-eval"
if [[ -s "pdfs/06-counterfactual-eval/2505.17801_integrating-counterfactual-simulations-with-language-models-for-explaining-multi.pdf" ]]; then echo "SKIP 2505.17801"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/06-counterfactual-eval/2505.17801_integrating-counterfactual-simulations-with-language-models-for-explaining-multi.pdf" "https://arxiv.org/pdf/2505.17801"; then echo "OK   2505.17801"; ok=$((ok+1));
else echo "FAIL 2505.17801 https://arxiv.org/pdf/2505.17801"; rm -f "pdfs/06-counterfactual-eval/2505.17801_integrating-counterfactual-simulations-with-language-models-for-explaining-multi.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/06-counterfactual-eval"
if [[ -s "pdfs/06-counterfactual-eval/2403.03956_backtracing-wang-wirawarn-khattab-goodman-demszky-eacl-findings-2024.pdf" ]]; then echo "SKIP 2403.03956"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/06-counterfactual-eval/2403.03956_backtracing-wang-wirawarn-khattab-goodman-demszky-eacl-findings-2024.pdf" "https://arxiv.org/pdf/2403.03956"; then echo "OK   2403.03956"; ok=$((ok+1));
else echo "FAIL 2403.03956 https://arxiv.org/pdf/2403.03956"; rm -f "pdfs/06-counterfactual-eval/2403.03956_backtracing-wang-wirawarn-khattab-goodman-demszky-eacl-findings-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/06-counterfactual-eval"
if [[ -s "pdfs/06-counterfactual-eval/2410.03017_tutor-copilot-wang-ribeiro-robinson-loeb-demszky-2024.pdf" ]]; then echo "SKIP 2410.03017"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/06-counterfactual-eval/2410.03017_tutor-copilot-wang-ribeiro-robinson-loeb-demszky-2024.pdf" "https://arxiv.org/pdf/2410.03017"; then echo "OK   2410.03017"; ok=$((ok+1));
else echo "FAIL 2410.03017 https://arxiv.org/pdf/2410.03017"; rm -f "pdfs/06-counterfactual-eval/2410.03017_tutor-copilot-wang-ribeiro-robinson-loeb-demszky-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2306.05685_judging-llm-as-a-judge-with-mt-bench-and-chatbot-arena.pdf" ]]; then echo "SKIP 2306.05685"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2306.05685_judging-llm-as-a-judge-with-mt-bench-and-chatbot-arena.pdf" "https://arxiv.org/pdf/2306.05685"; then echo "OK   2306.05685"; ok=$((ok+1));
else echo "FAIL 2306.05685 https://arxiv.org/pdf/2306.05685"; rm -f "pdfs/07-llm-as-judge/2306.05685_judging-llm-as-a-judge-with-mt-bench-and-chatbot-arena.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2403.04132_lmsys-chatbot-arena-chiang-et-al-2024.pdf" ]]; then echo "SKIP 2403.04132"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2403.04132_lmsys-chatbot-arena-chiang-et-al-2024.pdf" "https://arxiv.org/pdf/2403.04132"; then echo "OK   2403.04132"; ok=$((ok+1));
else echo "FAIL 2403.04132 https://arxiv.org/pdf/2403.04132"; rm -f "pdfs/07-llm-as-judge/2403.04132_lmsys-chatbot-arena-chiang-et-al-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2406.07791_judging-the-judges-a-systematic-study-of-position-bias-in-llm-as-a-judge.pdf" ]]; then echo "SKIP 2406.07791"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2406.07791_judging-the-judges-a-systematic-study-of-position-bias-in-llm-as-a-judge.pdf" "https://arxiv.org/pdf/2406.07791"; then echo "OK   2406.07791"; ok=$((ok+1));
else echo "FAIL 2406.07791 https://arxiv.org/pdf/2406.07791"; rm -f "pdfs/07-llm-as-judge/2406.07791_judging-the-judges-a-systematic-study-of-position-bias-in-llm-as-a-judge.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2406.12319_the-comparative-trap-pairwise-comparisons-amplifies-biased-preferences-of-llm-ev.pdf" ]]; then echo "SKIP 2406.12319"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2406.12319_the-comparative-trap-pairwise-comparisons-amplifies-biased-preferences-of-llm-ev.pdf" "https://arxiv.org/pdf/2406.12319"; then echo "OK   2406.12319"; ok=$((ok+1));
else echo "FAIL 2406.12319 https://arxiv.org/pdf/2406.12319"; rm -f "pdfs/07-llm-as-judge/2406.12319_the-comparative-trap-pairwise-comparisons-amplifies-biased-preferences-of-llm-ev.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2403.16950_aligning-with-human-judgement-the-role-of-pairwise-preference-in-llm-evaluators.pdf" ]]; then echo "SKIP 2403.16950"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2403.16950_aligning-with-human-judgement-the-role-of-pairwise-preference-in-llm-evaluators.pdf" "https://arxiv.org/pdf/2403.16950"; then echo "OK   2403.16950"; ok=$((ok+1));
else echo "FAIL 2403.16950 https://arxiv.org/pdf/2403.16950"; rm -f "pdfs/07-llm-as-judge/2403.16950_aligning-with-human-judgement-the-role-of-pairwise-preference-in-llm-evaluators.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2602.16610_who-can-we-trust-llm-as-a-jury-for-comparative-assessment.pdf" ]]; then echo "SKIP 2602.16610"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2602.16610_who-can-we-trust-llm-as-a-jury-for-comparative-assessment.pdf" "https://arxiv.org/pdf/2602.16610"; then echo "OK   2602.16610"; ok=$((ok+1));
else echo "FAIL 2602.16610 https://arxiv.org/pdf/2602.16610"; rm -f "pdfs/07-llm-as-judge/2602.16610_who-can-we-trust-llm-as-a-jury-for-comparative-assessment.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2508.09724_uda-unsupervised-debiasing-alignment-for-pair-wise-llm-as-a-judge.pdf" ]]; then echo "SKIP 2508.09724"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2508.09724_uda-unsupervised-debiasing-alignment-for-pair-wise-llm-as-a-judge.pdf" "https://arxiv.org/pdf/2508.09724"; then echo "OK   2508.09724"; ok=$((ok+1));
else echo "FAIL 2508.09724 https://arxiv.org/pdf/2508.09724"; rm -f "pdfs/07-llm-as-judge/2508.09724_uda-unsupervised-debiasing-alignment-for-pair-wise-llm-as-a-judge.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2509.26072_the-silent-judge-unacknowledged-shortcut-bias-in-llm-as-a-judge-neurips-2025-wor.pdf" ]]; then echo "SKIP 2509.26072"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2509.26072_the-silent-judge-unacknowledged-shortcut-bias-in-llm-as-a-judge-neurips-2025-wor.pdf" "https://arxiv.org/pdf/2509.26072"; then echo "OK   2509.26072"; ok=$((ok+1));
else echo "FAIL 2509.26072 https://arxiv.org/pdf/2509.26072"; rm -f "pdfs/07-llm-as-judge/2509.26072_the-silent-judge-unacknowledged-shortcut-bias-in-llm-as-a-judge-neurips-2025-wor.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2602.06625_fairjudge-an-adaptive-debiased-and-consistent-llm-as-a-judge.pdf" ]]; then echo "SKIP 2602.06625"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2602.06625_fairjudge-an-adaptive-debiased-and-consistent-llm-as-a-judge.pdf" "https://arxiv.org/pdf/2602.06625"; then echo "OK   2602.06625"; ok=$((ok+1));
else echo "FAIL 2602.06625 https://arxiv.org/pdf/2602.06625"; rm -f "pdfs/07-llm-as-judge/2602.06625_fairjudge-an-adaptive-debiased-and-consistent-llm-as-a-judge.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2507.10579_bea-2025-shared-task-on-pedagogical-ability-assessment-of-ai-powered-tutors.pdf" ]]; then echo "SKIP 2507.10579"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2507.10579_bea-2025-shared-task-on-pedagogical-ability-assessment-of-ai-powered-tutors.pdf" "https://arxiv.org/pdf/2507.10579"; then echo "OK   2507.10579"; ok=$((ok+1));
else echo "FAIL 2507.10579 https://arxiv.org/pdf/2507.10579"; rm -f "pdfs/07-llm-as-judge/2507.10579_bea-2025-shared-task-on-pedagogical-ability-assessment-of-ai-powered-tutors.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2502.18940_mathtutorbench-macina-daheim-hakimi-kapur-gurevych-sachan-2025.pdf" ]]; then echo "SKIP 2502.18940"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2502.18940_mathtutorbench-macina-daheim-hakimi-kapur-gurevych-sachan-2025.pdf" "https://arxiv.org/pdf/2502.18940"; then echo "OK   2502.18940"; ok=$((ok+1));
else echo "FAIL 2502.18940 https://arxiv.org/pdf/2502.18940"; rm -f "pdfs/07-llm-as-judge/2502.18940_mathtutorbench-macina-daheim-hakimi-kapur-gurevych-sachan-2025.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/07-llm-as-judge"
if [[ -s "pdfs/07-llm-as-judge/2510.23477_mmtutorbench.pdf" ]]; then echo "SKIP 2510.23477"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/07-llm-as-judge/2510.23477_mmtutorbench.pdf" "https://arxiv.org/pdf/2510.23477"; then echo "OK   2510.23477"; ok=$((ok+1));
else echo "FAIL 2510.23477 https://arxiv.org/pdf/2510.23477"; rm -f "pdfs/07-llm-as-judge/2510.23477_mmtutorbench.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/08-educational-datasets"
if [[ -s "pdfs/08-educational-datasets/2507.22753_edudial.pdf" ]]; then echo "SKIP 2507.22753"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/08-educational-datasets/2507.22753_edudial.pdf" "https://arxiv.org/pdf/2507.22753"; then echo "OK   2507.22753"; ok=$((ok+1));
else echo "FAIL 2507.22753 https://arxiv.org/pdf/2507.22753"; rm -f "pdfs/08-educational-datasets/2507.22753_edudial.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2306.15448_bigtom-gandhi-fränken-gerstenberg-goodman-neurips-2023.pdf" ]]; then echo "SKIP 2306.15448"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2306.15448_bigtom-gandhi-fränken-gerstenberg-goodman-neurips-2023.pdf" "https://arxiv.org/pdf/2306.15448"; then echo "OK   2306.15448"; ok=$((ok+1));
else echo "FAIL 2306.15448 https://arxiv.org/pdf/2306.15448"; rm -f "pdfs/09-theory-of-mind/2306.15448_bigtom-gandhi-fränken-gerstenberg-goodman-neurips-2023.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2310.15421_fantom-kim-et-al-emnlp-2023.pdf" ]]; then echo "SKIP 2310.15421"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2310.15421_fantom-kim-et-al-emnlp-2023.pdf" "https://arxiv.org/pdf/2310.15421"; then echo "OK   2310.15421"; ok=$((ok+1));
else echo "FAIL 2310.15421 https://arxiv.org/pdf/2310.15421"; rm -f "pdfs/09-theory-of-mind/2310.15421_fantom-kim-et-al-emnlp-2023.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2402.06044_opentom-xu-et-al-2024.pdf" ]]; then echo "SKIP 2402.06044"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2402.06044_opentom-xu-et-al-2024.pdf" "https://arxiv.org/pdf/2402.06044"; then echo "OK   2402.06044"; ok=$((ok+1));
else echo "FAIL 2402.06044 https://arxiv.org/pdf/2402.06044"; rm -f "pdfs/09-theory-of-mind/2402.06044_opentom-xu-et-al-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2402.15052_tombench-chen-et-al-2024.pdf" ]]; then echo "SKIP 2402.15052"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2402.15052_tombench-chen-et-al-2024.pdf" "https://arxiv.org/pdf/2402.15052"; then echo "OK   2402.15052"; ok=$((ok+1));
else echo "FAIL 2402.15052 https://arxiv.org/pdf/2402.15052"; rm -f "pdfs/09-theory-of-mind/2402.15052_tombench-chen-et-al-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2412.12175_exploretom-sclar-et-al-meta-2024.pdf" ]]; then echo "SKIP 2412.12175"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2412.12175_exploretom-sclar-et-al-meta-2024.pdf" "https://arxiv.org/pdf/2412.12175"; then echo "OK   2412.12175"; ok=$((ok+1));
else echo "FAIL 2412.12175 https://arxiv.org/pdf/2412.12175"; rm -f "pdfs/09-theory-of-mind/2412.12175_exploretom-sclar-et-al-meta-2024.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2302.08399_large-language-models-fail-on-trivial-alterations-to-theory-of-mind-tasks.pdf" ]]; then echo "SKIP 2302.08399"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2302.08399_large-language-models-fail-on-trivial-alterations-to-theory-of-mind-tasks.pdf" "https://arxiv.org/pdf/2302.08399"; then echo "OK   2302.08399"; ok=$((ok+1));
else echo "FAIL 2302.08399 https://arxiv.org/pdf/2302.08399"; rm -f "pdfs/09-theory-of-mind/2302.08399_large-language-models-fail-on-trivial-alterations-to-theory-of-mind-tasks.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/09-theory-of-mind"
if [[ -s "pdfs/09-theory-of-mind/2507.15788_small-llms-do-not-learn-a-generalizable-theory-of-mind-via-reinforcement-learnin.pdf" ]]; then echo "SKIP 2507.15788"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/09-theory-of-mind/2507.15788_small-llms-do-not-learn-a-generalizable-theory-of-mind-via-reinforcement-learnin.pdf" "https://arxiv.org/pdf/2507.15788"; then echo "OK   2507.15788"; ok=$((ok+1));
else echo "FAIL 2507.15788 https://arxiv.org/pdf/2507.15788"; rm -f "pdfs/09-theory-of-mind/2507.15788_small-llms-do-not-learn-a-generalizable-theory-of-mind-via-reinforcement-learnin.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/10-long-term-memory"
if [[ -s "pdfs/10-long-term-memory/2310.08560_memgpt-packer-et-al-berkeley-sky-lab-2023.pdf" ]]; then echo "SKIP 2310.08560"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/10-long-term-memory/2310.08560_memgpt-packer-et-al-berkeley-sky-lab-2023.pdf" "https://arxiv.org/pdf/2310.08560"; then echo "OK   2310.08560"; ok=$((ok+1));
else echo "FAIL 2310.08560 https://arxiv.org/pdf/2310.08560"; rm -f "pdfs/10-long-term-memory/2310.08560_memgpt-packer-et-al-berkeley-sky-lab-2023.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/10-long-term-memory"
if [[ -s "pdfs/10-long-term-memory/2508.03275_llm-enhanced-concept-based-test-oriented-repetition-for-adaptive-spaced-learning.pdf" ]]; then echo "SKIP 2508.03275"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/10-long-term-memory/2508.03275_llm-enhanced-concept-based-test-oriented-repetition-for-adaptive-spaced-learning.pdf" "https://arxiv.org/pdf/2508.03275"; then echo "OK   2508.03275"; ok=$((ok+1));
else echo "FAIL 2508.03275 https://arxiv.org/pdf/2508.03275"; rm -f "pdfs/10-long-term-memory/2508.03275_llm-enhanced-concept-based-test-oriented-repetition-for-adaptive-spaced-learning.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/10-long-term-memory"
if [[ -s "pdfs/10-long-term-memory/2512.12856_forgetful-but-faithful-a-cognitive-memory-architecture-for-privacy-aware-generat.pdf" ]]; then echo "SKIP 2512.12856"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/10-long-term-memory/2512.12856_forgetful-but-faithful-a-cognitive-memory-architecture-for-privacy-aware-generat.pdf" "https://arxiv.org/pdf/2512.12856"; then echo "OK   2512.12856"; ok=$((ok+1));
else echo "FAIL 2512.12856 https://arxiv.org/pdf/2512.12856"; rm -f "pdfs/10-long-term-memory/2512.12856_forgetful-but-faithful-a-cognitive-memory-architecture-for-privacy-aware-generat.pdf"; fail=$((fail+1)); fi
sleep 0.5

mkdir -p "pdfs/10-long-term-memory"
if [[ -s "pdfs/10-long-term-memory/2603.04740_memory-in-the-age-of-ai-agents-dec-2025-survey.pdf" ]]; then echo "SKIP 2603.04740"; skip=$((skip+1));
elif curl -fsSL --max-time 60 -A "$UA" -o "pdfs/10-long-term-memory/2603.04740_memory-in-the-age-of-ai-agents-dec-2025-survey.pdf" "https://arxiv.org/pdf/2603.04740"; then echo "OK   2603.04740"; ok=$((ok+1));
else echo "FAIL 2603.04740 https://arxiv.org/pdf/2603.04740"; rm -f "pdfs/10-long-term-memory/2603.04740_memory-in-the-age-of-ai-agents-dec-2025-survey.pdf"; fail=$((fail+1)); fi
sleep 0.5

echo
echo "Done. ok=$ok skip=$skip fail=$fail"
exit $fail