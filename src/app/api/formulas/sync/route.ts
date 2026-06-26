import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const syncKey = req.headers.get("x-sync-key");

  if (syncKey !== process.env.FORMULAS_SYNC_KEY) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const body = await req.json();

  return NextResponse.json({
    ok: true,
    registrosRecebidos: Array.isArray(body) ? body.length : 0,
  });
}