export function createEvaluateJudge(context) {
  const { callSelectedCliJudgeText, effectiveJudgeModel, judgeCli, judgeCliEffort } = context;
  return async function callClaudeJudge(prompt) {
    const stdout = await callSelectedCliJudgeText(
      judgeCli,
      effectiveJudgeModel,
      prompt,
      'eval-cli-holistic-evaluation',
      judgeCliEffort,
    );

    let jsonStr = stdout.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
    }
    return JSON.parse(jsonStr);
  };
}
