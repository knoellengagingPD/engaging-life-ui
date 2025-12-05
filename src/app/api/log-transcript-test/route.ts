import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

const bigquery = new BigQuery();

export async function GET() {
  try {
    const datasetId = "engaging_life";
    const tableId = "transcripts";

    const rows = [
      {
        timestamp: new Date().toISOString(),
        session_id: "test-session",
        speaker: "system",
        transcript: "This is a test insert from /api/log-transcript-test",
        module: "test",
      },
    ];

    await bigquery.dataset(datasetId).table(tableId).insert(rows);

    return NextResponse.json({
      success: true,
      message: "Test row inserted.",
    });
  } catch (error: any) {
    console.error("BigQuery test insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
