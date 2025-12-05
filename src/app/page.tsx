'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  /* ------------------------------------------------------------
      CORE STATE
  ------------------------------------------------------------- */
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [sessionId] = useState(`session-${Date.now()}`);

  /* ------------------------------------------------------------
      MODULE STATE (NEW FOR ENGAGING LIFE AUTHORING)
      Starts at module_1 (voice interview)
  ------------------------------------------------------------- */
  const [currentModule, setCurrentModule] = useState("module_1");

  /* ------------------------------------------------------------
      WEBRTC REFERENCES
  ------------------------------------------------------------- */
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  /* ------------------------------------------------------------
      BIGQUERY LOGGING (UPDATED FOR AUTHORING MODULES)
  ------------------------------------------------------------- */
  const logToBigQuery = async (
    speaker: string,
    transcript: string,
    module: string
  ) => {
    try {
      await fetch('/api/log-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          sessionId,
          speaker,
          transcript,
          module,
        }),
      });
    } catch (err) {
      console.error('Failed to log to BigQuery:', err);
    }
  };

  /* ------------------------------------------------------------
      START INTERVIEW
  ------------------------------------------------------------- */
  const startInterview = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const tokenResponse = await fetch('/api/realtime-session', {
        method: 'POST',
      });

      if (!tokenResponse.ok) throw new Error('Failed to get session token');

      const { clientSecret } = await tokenResponse.json();
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      /* ---------- AUDIO OUTPUT ---------- */
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      /* ---------- AUDIO INPUT ---------- */
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(ms.getTracks()[0]);

      /* ---------- DATA CHANNEL ---------- */
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.addEventListener('open', () => {
        console.log('Data channel opened');

        setIsActive(true);
        setIsConnecting(false);

        /* ------------------------------------------------------------
            SESSION INSTRUCTIONS
            THIS IS WHERE MODULE 1 BEGINS
        ------------------------------------------------------------- */
        const sessionUpdate = {
          type: 'session.update',
          session: {
            instructions: `
You are Engaging Life Unified — a warm, calm, patient Future Authoring guide.
You operate as a strict state machine with 4 modules:

MODULE 1 — Voice Interview (ideal future + future to avoid)
MODULE 2 — Automatic Goal Extraction
MODULE 3 — Text-based Refinement & Implementation Intentions
MODULE 4 — Final Report Generator

Do NOT mix modules. Always follow EXACT module rules.

GLOBAL RULES (ALWAYS):
- Warm tone, gentle voice, 1.75x speed
- 3–4 second pauses between questions
- If user is silent: “Take your time, I’m listening.”
- If response is short: “Could you share a little more about that?”
- ALWAYS output raw Whisper transcription, even if low confidence.
- NEVER replace speech with “inaudible”
- ALWAYS log speaker + transcript + module state
- DO NOT summarize the user

Begin in MODULE 1 with:

“Hello and welcome. Today we’ll walk through a Future Authoring interview to help you imagine your ideal future and understand the future you want to avoid. If you want me to repeat or slow down at any point, just say so. Whenever you're ready, we’ll begin.”

Then proceed through ALL Module 1 questions, in order.

At the end of Module 1:
“Thank you. I now have everything I need to identify your core goals. Please wait a moment while I analyze your responses.”

Then automatically move to MODULE 2.
`,
            voice: 'alloy',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: { type: 'server_vad' },
          },
        };

        dc.send(JSON.stringify(sessionUpdate));

        setTimeout(() => {
          dc.send(JSON.stringify({ type: 'response.create' }));
        }, 100);
      });

      /* ------------------------------------------------------------
          HANDLE INCOMING REAL-TIME MESSAGES
      ------------------------------------------------------------- */
      dc.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        console.log("REALTIME MESSAGE:", msg);

        /* ---------- AI OUTPUT (TRANSCRIPTS FROM CLARITY) ---------- */
        if (msg.type === 'response.audio_transcript.delta') {
          setCurrentMessage((prev) => prev + msg.delta);
        }

        if (msg.type === 'response.audio_transcript.done') {
          setAiMessages((prev) => [msg.transcript, ...prev]);
          setCurrentMessage('');
          setProgress((prev) => Math.min(prev + 12, 100));

          logToBigQuery("clarity", msg.transcript, currentModule);
        }

        /* ---------- USER SPEECH COMPLETED ---------- */
        if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          logToBigQuery("user", msg.transcript, currentModule);
        }

        /* ---------- RESET CURRENT MESSAGE ---------- */
        if (msg.type === 'response.created') {
          setCurrentMessage('');
        }
      });

      /* ------------------------------------------------------------
          WEBRTC OFFER / ANSWER
      ------------------------------------------------------------- */
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) throw new Error('Failed to connect to Realtime API');

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setIsConnecting(false);
    }
  };

  /* ------------------------------------------------------------
      PAUSE AUDIO
  ------------------------------------------------------------- */
  const togglePause = () => {
    if (!audioRef.current) return;
    if (isPaused) audioRef.current.play();
    else audioRef.current.pause();
    setIsPaused(!isPaused);
  };

  /* ------------------------------------------------------------
      STOP INTERVIEW
  ------------------------------------------------------------- */
  const stopInterview = () => {
    if (pcRef.current) pcRef.current.close();
    if (audioRef.current) audioRef.current.srcObject = null;

    setIsActive(false);
    setIsPaused(false);
    setAiMessages([]);
    setCurrentMessage('');
    setProgress(0);
  };

  /* ------------------------------------------------------------
      LANDING PAGE BEFORE INTERVIEW STARTS
  ------------------------------------------------------------- */
  if (!isActive && aiMessages.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="text-center p-12 bg-white rounded-3xl shadow-2xl max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            Welcome to the Engaging Life Authoring Experience!
          </h1>

          <p className="text-gray-700 text-lg mb-8">
            This guided experience will help you imagine your ideal future,
            clarify what you want to avoid, identify core goals, refine them,
            and create a complete written Future Authoring plan.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={startInterview}
            disabled={isConnecting}
            className="inline-block px-14 py-6 bg-blue-600 text-white text-2xl font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Begin →'}
          </button>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------
      ACTIVE INTERVIEW UI
  ------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start p-8">
      <div className="relative mb-8 mt-16">
        <div className={`w-96 h-96 rounded-full bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700 shadow-2xl ${isActive ? 'animate-pulse-strong' : ''}`}></div>
      </div>

      {/* Progress bar + Pause + Stop */}
      <div className="w-full max-w-3xl mb-8 flex items-center gap-4">
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">Progress</p>
        </div>
        
        <button
          onClick={togglePause}
          className="px-4 py-4 bg-white text-blue-700 text-sm font-bold rounded-lg border-2 border-blue-700 shadow-md hover:shadow-lg transition flex flex-col items-center justify-center w-20 h-20"
        >
          <div>{isPaused ? 'Resume' : 'Pause'}</div>
          <div>Audio</div>
        </button>

        <button
          onClick={stopInterview}
          className="px-4 py-4 bg-white text-blue-700 text-sm font-bold rounded-lg border-2 border-blue-700 shadow-md hover:shadow-lg transition flex flex-col items-center justify-center w-20 h-20"
        >
          <div>Stop</div>
          <div>Interview</div>
        </button>
      </div>

      {/* Current speaking */}
      {currentMessage && (
        <div className="w-full max-w-3xl mb-2 animate-fade-in">
          <p className="text-xl text-gray-800 font-bold text-center leading-relaxed">
            {currentMessage}
          </p>
        </div>
      )}

      {/* Most recent message */}
      {!currentMessage && aiMessages.length > 0 && (
        <div className="w-full max-w-3xl mb-2">
          <p className="text-xl text-gray-800 font-bold text-center leading-relaxed">
            {aiMessages[0]}
          </p>
        </div>
      )}

      {/* History */}
      <div className="w-full max-w-3xl mb-6 overflow-hidden" style={{ maxHeight: '150px' }}>
        <div className="flex flex-col">
          {aiMessages.slice(1, 4).map((text, idx) => (
            <div key={idx} className="py-2 opacity-60">
              <p className="text-base text-gray-600 text-center leading-relaxed">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        @keyframes pulse-strong {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        .animate-pulse-strong {
          animation: pulse-strong 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
