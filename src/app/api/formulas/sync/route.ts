import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    // Valida chave de sincronização
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
        { error: "Payload deve ser um array." },
        { status: 400 }
      );
    }

    // Converte os nomes da planilha para os nomes do banco
    const formulas = body.map((f: any) => ({
      nome: f["Nome"] ?? f["nome"] ?? "",
      mo: Number(f["MO"] ?? 0),
      map: Number(f["MAP"] ?? 0),
      calcario_concha: Number(f["Calcário Concha"] ?? f["Calcario Concha"] ?? 0),
      sulfato_amonia: Number(f["Sulfato Amônia"] ?? f["Sulfato Amonia"] ?? 0),
      carbonato_ca_mg: Number(f["Carbonato Ca Mg"] ?? 0),
      ureia: Number(f["Ureia"] ?? 0),
      cloreto_potassio: Number(f["Cloreto Potássio"] ?? f["Cloreto Potassio"] ?? 0),
      enxofre_pastilhado: Number(f["Enxofre Pastilhado"] ?? 0),
      oxmag_s: Number(f["Oxmag S"] ?? 0),
      tsp: Number(f["TSP"] ?? 0),
      caltimag: Number(f["Caltimag"] ?? 0),
      hiphos_25: Number(f["Hiphos 25"] ?? 0),
      ativo: true,
    }));

    const { error } = await supabaseAdmin
      .from("formulas")
      .upsert(formulas, {
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
      success: true,
      sincronizadas: formulas.length,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 }
    );
  }
}