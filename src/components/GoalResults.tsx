'use client';

type GoalAreaResult = {
  area: string;
  summary: string;
  confidence?: number; // 0..1
  quotes?: string[];
};

export type GoalAnalysis = {
  areas: GoalAreaResult[];
  overallSummary?: string;
  sessionId?: string;
  createdAt?: string;
};

type GoalResultsProps = {
  analysis: GoalAnalysis;
};

export function GoalResults({ analysis }: GoalResultsProps) {
  if (!analysis) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 space-y-8">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Your Engaging Purpose Summary
            </h2>
            <p className="text-slate-600 mt-1">
              A structured snapshot of what you said, grouped into key life areas.
            </p>
          </div>

          {analysis.sessionId && (
            <div className="text-xs text-slate-500 text-right">
              <div className="font-medium">Session</div>
              <div className="font-mono">{analysis.sessionId}</div>
            </div>
          )}
        </div>
      </div>

      {/* Overall Summary */}
      {analysis.overallSummary && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-indigo-900 mb-2">
            Overall Summary
          </h3>
          <p className="text-slate-800 leading-relaxed">
            {analysis.overallSummary}
          </p>
        </div>
      )}

      {/* Per-area cards */}
      <div className="grid grid-cols-1 gap-6">
        {analysis.areas?.map((area, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-lg font-semibold text-slate-900">
                {area.area}
              </h4>

              {typeof area.confidence === 'number' && (
                <div className="text-sm font-medium text-slate-600">
                  Confidence: {Math.round(area.confidence * 100)}%
                </div>
              )}
            </div>

            <p className="text-slate-700 leading-relaxed mt-3">
              {area.summary}
            </p>

            {area.quotes && area.quotes.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-600 mb-2">
                  Supporting quotes
                </p>
                <ul className="space-y-2">
                  {area.quotes.map((q, i) => (
                    <li
                      key={i}
                      className="text-sm italic text-slate-700 bg-slate-50 border border-slate-100 p-3 rounded-xl"
                    >
                      “{q}”
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
