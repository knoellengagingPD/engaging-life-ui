// src/lib/useRealtimeTranscription.ts
'use client';

import { useCallback, useRef, useState } from 'react';

type UseRealtimeTranscriptionArgs = {
  onFinalTranscript?: (text: string) => void;
};

type Status = 'idle' | 'connecting' | 'listening' | 'error';

export function useRealtimeTranscription(args: UseRealtimeTranscriptionArgs = {}) {
  const { onFinalTranscript } = args;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const msRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string>('');

  const cleanup = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      msRef.current?.getTracks().forEach(t => t.stop());
    } catch {}
    msRef.current = null;

    setPartial('');
    setStatus('idle');
  }, []);

  const sendEvent = useCallback((evt: any) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    dc.send(JSON.stringify(evt));
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setStatus('connecting');

      // 1) mint ephemeral token from your server
      const tokenRes = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!tokenRes.ok) {
        throw new Error('Failed to mint client secret');
      }
      const tokenData = await tokenRes.json();
      const EPHEMERAL_KEY = tokenData?.value;
      if (!EPHEMERAL_KEY) throw new Error('No client secret returned');

      // 2) create peer connection + mic
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      msRef.current = ms;
      pc.addTrack(ms.getTracks()[0]);

      // 3) data channel for events (transcript deltas, completed turns, etc.)
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data);

          // We care about transcription events
          // - delta: incremental
          // - completed: final turn transcript
          if (evt?.type === 'conversation.item.input_audio_transcription.delta') {
            setPartial(prev => (prev + (evt.delta || '')));
          }

          if (evt?.type === 'conversation.item.input_audio_transcription.completed') {
            const finalText = (evt.transcript || '').trim();
            setPartial('');
            if (finalText) onFinalTranscript?.(finalText);
          }
        } catch {
          // ignore non-JSON
        }
      };

      dc.onopen = () => {
        // Reinforce transcription settings (even though we requested them on the server).
        // With server_vad enabled, turns commit automatically on silence.
        sendEvent({
          type: 'session.update',
          session: {
            audio: {
              input: {
                transcription: {
                  model: 'gpt-4o-mini-transcribe',
                  language: 'en',
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 700,
                },
                noise_reduction: { type: 'near_field' },
              },
            },
          },
        });

        setStatus('listening');
      };

      // 4) Offer/Answer exchange with OpenAI Realtime via WebRTC SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      const answerSdp = await sdpResponse.text();
      if (!sdpResponse.ok) {
        throw new Error(answerSdp || 'Failed to establish WebRTC session');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // If the data channel opens, status becomes 'listening'
    } catch (e: any) {
      setError(e?.message || 'Voice connection failed');
      setStatus('error');
      cleanup();
    }
  }, [cleanup, onFinalTranscript, sendEvent]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    status,
    error,
    partial,
    start,
    stop,
  };
}
