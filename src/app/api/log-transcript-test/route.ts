import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET() {
  const id = crypto.randomUUID();

  await kv.set(`test:${id}`, {
    message: "Test log saved successfully",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    id,
  });
}
