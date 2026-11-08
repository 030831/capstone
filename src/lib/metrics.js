export function summarize(records) {
  const questions = records.flatMap((r) => r.questions || []);
  const answered = questions.filter((q) => typeof q.firstCorrect === 'boolean');
  const firstCorrect = answered.filter((q) => q.firstCorrect).length;
  const withHint = questions.filter((q) => (q.hints || 0) > 0).length;
  const correct = answered.filter((q) => q.correct).length;
  return {
    sessions: records.length,
    answered: answered.length,
    firstCorrect,
    withHint,
    correct,
    accuracy: answered.length ? Math.round((firstCorrect / answered.length) * 100) : null,
  };
}
