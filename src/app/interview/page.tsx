'use client';

import { useMemo, useState } from 'react';
import { GoalResults } from '@/components/GoalResults';

export default function InterviewPage() {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);

  // NEW: analysis + save state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  // Your 4 areas (reusable for other products later)
  const areas = useMemo(
    () => ['Family', 'Friends', 'Meaningful Work', 'Purpose/Faith'] as const,
    []
  );

  // -------------------------------------------
  // 1. CREATE REALTIME SESSION WITH YOUR API
  // -------------------------------------------
  async function startRealtimeSession() {
    try {
      const res = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to get session token');

      const data = await res.json();
      console.log('Realtime clientSecret:', data.clientSecret);

      setSessionSecret(data.clientSecret);

      // TODO: WebRTC / WebSocket initialization
      alert('✔ Realtime session started!\nCheck console for secret.');
    } catch (err) {
      console.error('Realtime session error:', err);
      alert('❌ Failed to get session token.');
    }
  }

  // -------------------------------------------
  // 2. TEST BIGQUERY LOGGING (unchanged)
  // -------------------------------------------
  async function sendTestLog() {
    try {
      const res = await fetch('/api/log-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          sessionId: 'test-session-123',
          speaker: 'user',
          transcript: 'This is a test transcript entry',
          module: 'future-authoring',
        }),
      });

      const data = await res.json();
      console.log('Logging result:', data);
      alert('✔ Test log sent — check BigQuery!');
    } catch (err) {
      console.error('Error sending test log:', err);
      alert('❌ Failed to send test log. Check console.');
    }
  }

  // -------------------------------------------
  // NEW: Analyze -> Save to KV pipeline
  // -------------------------------------------
  async function runPostInterviewPipeline(finalTranscript: string) {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setSavedSessionId(null);

    try {
      // 1) Analyze
      const aRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript, areas }),
      });

      const aJson = await aRes.json();
      if (!aRes.ok) throw new Error(aJson?.error || 'Analyze failed');

      setAnalysis(aJson);

      // 2) Save to KV
      const sRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          analysis: aJson,
          meta: { product: 'findmypurpose', interview: 'interview' },
        }),
      });

      const sJson = await sRes.json();
      if (!sRes.ok) throw new Error(sJson?.error || 'Save failed');

      setSavedSessionId(sJson.id);
    } catch (e: any) {
      console.error(e);
      setAnalyzeError(e?.message ?? String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  // -------------------------------------------
  // 3. SIMULATION OF INTERVIEW UI (updated)
  // -------------------------------------------
  const startInterview = async () => {
    setIsActive(true);

    // Clear old results when starting fresh
    setAnalyzeError(null);
    setAnalysis(null);
    setSavedSessionId(null);

    // FIRST: Start OpenAI realtime session
    await startRealtimeSession();

    // THEN: Run your simulated transcript UI
    setTimeout(() => {
      setTranscript([
        'Great! Could you please tell me your role at the school? Are you a student, teacher, non-instructional staff, or administrator?',
      ]);
    }, 1000);
  };

  const stopInterview = async () => {
    // capture transcript BEFORE clearing it
    const finalTranscript = transcript.join('\n');

    // stop UI immediately
    setIsActive(false);
    setTranscript([]);
    setSessionSecret(null);

    // if nothing captured, don’t run analysis
    if (!finalTranscript.trim()) {
      setAnalyzeError('No transcript captured to analyze.');
      return;
    }

    // run analysis + save
    await runPostInterviewPipeline(finalTranscript);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start p-8">
      {/* Buttons */}
      <div className="flex gap-8 mb-16 mt-8 flex-wrap justify-center">
        <button
          onClick={startInterview}
          disabled={isActive || analyzing}
          className="px-16 py-6 bg-gradient-to-b from-blue-200 to-blue-400 text-gray-800 text-2xl font-medium rounded-full border-2 border-blue-300 shadow-lg hover:shadow-xl transition disabled:opacity-50"
        >
          Start Interview
        </button>

        <button
          onClick={stopInterview}
          disabled={!isActive || analyzing}
          className="px-16 py-6 bg-gradient-to-b from-blue-200 to-blue-400 text-gray-800 text-2xl font-medium rounded-full border-2 border-blue-300 shadow-lg hover:shadow-xl transition disabled:opacity-50"
        >
          Stop Interview
        </button>

        <button
          onClick={sendTestLog}
          disabled={analyzing}
          className="px-16 py-6 bg-green-500 text-white text-2xl font-semibold rounded-full shadow-lg hover:bg-green-600 transition disabled:opacity-50"
        >
          Send Test Log
        </button>
      </div>

      {/* Orb */}
      <div className="relative mb-10">
        <div
          className={`w-96 h-96 rounded-full bg-gradient-to-br from-blue-200 via-blue-300 to-blue-500 ${
            isActive ? 'animate-pulse' : ''
          } shadow-2xl`}
        ></div>
      </div>

      {/* Transcript */}
      {isActive && transcript.length > 0 && (
        <div className="max-w-3xl w-full space-y-6 mb-10">
          {transcript.map((text, idx) => (
            <div key={idx} className="animate-fade-in-up">
              <p className="text-xl text-gray-800 text-center leading-relaxed">
                {text}
              </p>
            </div>
          ))}

          <div className="text-xl text-gray-600 text-center italic mt-8">I am a student,</div>

          <div className="mt-12 mb-8">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: '35%' }}></div>
            </div>
          </div>

          <div className="animate-fade-in-up-delayed">
            <p className="text-xl text-gray-700 text-center leading-relaxed">
              Thanks! And could you please provide your school ID number for verification?
            </p>
          </div>
        </div>
      )}

      {/* NEW: Analysis status + results */}
      <div className="max-w-4xl w-full">
        {analyzing && (
          <div className="w-full border border-gray-200 rounded-2xl p-4 mb-4 text-center">
            <div className="text-lg font-semibold">Analyzing interview…</div>
            <div className="text-sm text-gray-500 mt-1">Generating goals and saving results.</div>
          </div>
        )}

        {analyzeError && (
          <div className="w-full border border-red-300 rounded-2xl p-4 mb-4">
            <div className="font-semibold text-red-700">Error</div>
            <div className="text-red-700 mt-1">{analyzeError}</div>
          </div>
        )}

        {savedSessionId && (
          <div className="w-full border border-gray-200 rounded-2xl p-4 mb-4">
            <div className="font-semibold">Saved</div>
            <div className="text-sm text-gray-600 mt-1">
              Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{savedSessionId}</code>
            </div>
          </div>
        )}

        <GoalResults data={analysis} />
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        .animate-fade-in-up-delayed {
          animation: fade-in-up 1s ease-out 1.5s both;
        }
      `}</style>
    </div>
  );
}
