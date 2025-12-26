// src/app/api/analyze/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Node runtime (not Edge)

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Optional: browser-friendly sanity check.
 * Visiting /api/analyze in a browser sends GET, so this prevents 405.
 */
export async function GET() {
  return new Response("Analyze endpoint is live. Use POST with JSON body.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

type AnalyzeRequest = {
  transcript: string;
  // Optional override: exactly 4 area names
  areas?: [string, string, string, string] | string[];
};

type Goal = {
  title: string;
  rationale: string;
  first_step_7_days: string;
  metric: string;
  time_horizon: string;
  confidence: "high" | "medium" | "low";
  evidence_quotes: string[];
};

type AreaResult = {
  name: string;
  goals: Goal[];
  follow_up_questions?: string[];
};

type AnalyzeResponse = {
  areas: AreaResult[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequest;

    if (!body?.transcript || typeof body.transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const defaultAreas: [string, string, string, string] = [
      "Family",
      "Friends",
      "Meaningful Work",
      "Purpose/Faith",
    ];

    const areas =
      Array.isArray(body.areas) && body.areas.length === 4
        ? (body.areas as [string, string, string, string])
        : defaultAreas;

    const system = [
      "You are an expert goal-coach and analyst.",
      "You turn interview transcripts into practical, realistic goals.",
      "You must output VALID JSON only, matching the schema provided.",
      "Do not invent facts; stay grounded in the transcript.",
    ].join(" ");

    const user = `
From the transcript below, propose potential goals in EXACTLY these four areas:
1) ${areas[0]}
2) ${areas[1]}
3) ${areas[2]}
4) ${areas[3]}

Rules:
- Base goals strictly on the transcript (no invention).
- For each area propose 2–4 goals.
- Each goal must include:
  - title
  - rationale (1–2 sentences)
  - first_step_7_days (a concrete action)
  - metric (how progress is measured)
  - time_horizon (e.g., 2 weeks, 3 months)
  - confidence (high/medium/low)
  - evidence_quotes (1–3 short quotes from transcript)
- If transcript is thin for an area:
  - include ONE goal with title "Needs clarification"
  - set confidence to "low"
  - add 2–3 follow_up_questions for that area

Return JSON with this shape ONLY:
{
  "areas": [
    {
      "name": "AREA NAME",
      "goals": [
        {
          "title": "",
          "rationale": "",
          "first_step_7_days": "",
          "metric": "",
          "time_horizon": "",
          "confidence": "high|medium|low",
          "evidence_quotes": ["", ""]
        }
      ],
      "follow_up_questions": ["", ""]
    }
  ]
}

Transcript:
"""
${body.transcript}
"""
`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = resp.choices[0]?.message?.content ?? "";

    // Ensure client always receives structured JSON
    let parsed: AnalyzeResponse;
    try {
      parsed = JSON.parse(content) as AnalyzeResponse;
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: content },
        { status: 502 }
      );
    }

    // Minimal validation: ensure areas array exists
    if (!parsed || !Array.isArray(parsed.areas)) {
      return NextResponse.json(
        { error: "Invalid JSON shape returned by model", raw: parsed },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
