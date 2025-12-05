'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Logging
  async function logToBigQuery(speaker: string, transcript: string) {
    try {
      await fetch('/api/log-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          sessionId,
          speaker,
          transcript,
          module: "module_1",
        }),
      });
    } catch (err) {
      console.error("Log error:", err);
    }
  }

  // Start session
  async function startInterview() {
    setIsConnecting(true);

    const tokenRes = await fetch('/api/realtime-session', { method: 'POST' });
    const { clientSecret } = await tokenRes.json();

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const audio = document.createElement('audio');
    audio.autoplay = true;
    audioRef.current = audio;

    pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

    const input = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(input.getTracks()[0]);

    const dc = pc.createDataChannel('oai-events');
    dcRef.current = dc;

    dc.onopen = () => {
      setIsActive(true);
      setIsConnecting(false);

      // Start voice interaction
      dc.send(JSON.stringify({ type: 'response.create' }));
    };

    dc.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "response.audio_transcript.delta") {
        setCurrentMessage(prev => prev + msg.delta);
      }

      if (msg.type === "response.audio_transcript.done") {
        setAiMessages(prev => [msg.transcript, ...prev]);
        logToBigQuery("ai", msg.transcript);

        // detect end of Module 1
        if (msg.transcript.includes("analyze your responses")) {
          setInterviewComplete(true);
        }

        setCurrentMessage('');
        setProgress(v => Math.min(v + 3, 100));
      }

      if (msg.type === "conversation.item.input_audio_transcription.completed") {
        logToBigQuery("user", msg.transcript);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const answerRes = await fetch("https://api.openai.com/v1/realtime", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    const answer = await answerRes.text();
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answer,
    });
  }

  function stopInterview() {
    pcRef.current?.close();
    if (audioRef.current) audioRef.current.srcObject = null;

    setIsActive(false);
    setProgress(0);
  }

  // UI
  if (!isActive && !interviewComplete) {
    return (
      <main className="h-screen flex flex-col items-center justify-center bg-blue-50">
        <h1 className="text-3xl font-bold mb-6">
          Welcome to the Engaging Life Authoring Experience
        </h1>

        <button
          onClick={startInterview}
          disabled={isConnecting}
          className="px-10 py-4 bg-blue-600 text-white rounded-xl shadow-lg"
        >
          {isConnecting ? "Connecting…" : "Begin Voice Interview"}
        </button>
      </main>
    );
  }

  if (interviewComplete) {
    return (
      <main className="h-screen flex flex-col items-center justify-center gap-6">
        <h2 className="text-2xl font-bold text-green-700">
          Module 1 Complete
        </h2>

        <p>Your voice interview has been logged.</p>

        <a
          href="/text"
          className="px-10 py-4 bg-purple-600 text-white rounded-xl shadow-lg"
        >
          Continue to Module 2 → Goal Extraction & Refinement
        </a>
      </main>
    );
  }

  return (
    <main className="p-8 flex flex-col items-center">
      <div className="w-80 h-80 bg-blue-400 rounded-full animate-pulse mb-8" />
      <h2 className="text-xl mb-4">{currentMessage || aiMessages[0]}</h2>
    </main>
  );
}
