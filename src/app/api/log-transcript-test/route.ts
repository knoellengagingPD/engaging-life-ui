import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "log-transcript-test is now disabled (BigQuery removed). Use POST /api/log-transcript to write to KV.",
  });
}
