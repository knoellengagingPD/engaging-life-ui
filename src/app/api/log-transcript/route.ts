import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = crypto.randomUUID();

    await kv.set(`transcript:${id}`, {
      ...body,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to save transcript" },
      { status: 500 }
    );
  }
}
