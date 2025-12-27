// src/app/api/realtime-session/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // keep this on Node (not Edge)

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY env var on the server." },
        { status: 500 }
      );
    }

    const sessionConfig = {
      session: {
        type: "realtime",
        model: "gpt-realtime",
        audio: {
          output: { voice: "marin" },
        },
      },
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Failed to create client secret", details: data },
        { status: resp.status }
      );
    }

    // Per docs: the ephemeral key is returned as `data.value`
    if (!data?.value) {
      return NextResponse.json(
        { error: "Unexpected response from /v1/realtime/client_secrets", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret: data.value });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error creating realtime client secret", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
