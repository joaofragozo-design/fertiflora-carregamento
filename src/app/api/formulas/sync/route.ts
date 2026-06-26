import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const syncKey = req.headers.get("x-sync-key");

  if (syncKey !== process.env.FORMULAS_SYNC_KEY) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const body = await req.json();

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Payload inválido." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("formulas")
    .upsert(body, {
      onConflict: "nome",
    });

  if (error) {
    console.error(error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    registros: body.length,
  });
}