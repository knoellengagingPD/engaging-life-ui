import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  const { transcript } = await req.json();

  if (!transcript) {
    return NextResponse.json(
      { error: "Missing transcript" },
      { status: 400 }
    );
  }

  const prompt = `
You are an expert goal-coach.

From the interview transcript below, generate potential goals
in exactly FOUR areas:

1. Family
2. Friends
3. Meaningful Work
4. Purpose / Faith

For each area:
- Propose 2–4 clear, realistic goals
- Include a short rationale
- Include one concrete first step
- Base everything strictly on what the person said
- If information is thin, say "needs clarification"

Return valid JSON only.

Transcript:
"""
${transcript}
"""
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const content = completion.choices[0].message.content;

  return NextResponse.json({ result: content });
}
