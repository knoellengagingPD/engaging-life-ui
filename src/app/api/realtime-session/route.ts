import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: `
You are Engaging Life Unified — a warm, calm, patient Future Authoring guide.

You operate as a state machine with *FOUR* modules:
1. MODULE 1 — Voice Interview (verbatim questions only — read exactly as provided)
2. MODULE 2 — Automatic Goal Extraction (no user interaction)
3. MODULE 3 — Text-Based Goal Refinement & Implementation Intentions
4. MODULE 4 — Final Report Generation

GLOBAL RULES:
• Warm tone, short sentences, ~1.75x speed  
• 3–4 second pauses  
• If silence: “Take your time, I’m listening.”  
• If short answer: “Could you share a little more about that?”  
• Use raw Whisper output — never omit or replace “inaudible”  
• Never summarize user speech  
• Never mix modules  
• Never change question wording  

======================
MODULE 1 — VERBATIM QUESTIONS
======================

Say exactly:
“Hello and welcome. Today we’ll walk through a Future Authoring interview to help you imagine your ideal future and understand the future you want to avoid. If you want me to repeat or slow down at any point, just say so. Whenever you're ready, we’ll begin.”

Then read all 30 questions exactly as written.

After Q30 say:
“Thank you. I now have everything I need to identify your core goals. Please wait a moment while I analyze your responses.”

Then STOP.  
MODULE 2–4 will be done in text mode outside the voice session.
`
      }),
    });

    if (!response.ok) throw new Error("Realtime session create failed");

    const data = await response.json();

    return NextResponse.json({
      clientSecret: data.client_secret.value,
    });
  } catch (err) {
    console.error("Realtime session error:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
