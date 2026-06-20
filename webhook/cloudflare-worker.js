const AIRTABLE_BASE_ID = "app7hsjUV9mUTiK1P";
const AIRTABLE_TABLE_NAME = "01_Inbound";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePerfil(value) {
  const perfil = String(value || "").trim();
  if (perfil === "Titular do crédito") return "credor";
  if (perfil === "Advogado(a)") return "advogado";
  if (perfil === "Representante autorizado") return "representante";
  return perfil || "outro";
}

function normalizeCurrency(value) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

async function createAirtableRecord(payload, env) {
  const now = new Date();
  const fields = {
    data_entrada: now.toISOString(),
    status: "novo",
    sla_status: "aguardando",
    sla_resposta: addMinutes(now, 24 * 60),
    nome: payload.nome,
    email: payload.email,
    telefone: payload.telefone,
    perfil: normalizePerfil(payload.perfil),
    numero_cnj: payload.numero_cnj,
    tribunal: payload.tribunal,
    advogado_informado: payload.advogado_informado || "",
    mensagem: payload.mensagem || "",
    consentimento_contato: Boolean(payload.consentimento_contato),
    aceite_privacidade: Boolean(payload.aceite_privacidade),
    owner: "",
  };

  const valorInformado = normalizeCurrency(payload.valor_informado);
  if (valorInformado !== undefined) {
    fields.valor_informado = valorInformado;
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Airtable ${response.status}: ${details}`);
  }

  return response.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
    }

    if (
      !required(payload.nome) ||
      !required(payload.email) ||
      !required(payload.telefone) ||
      !required(payload.numero_cnj) ||
      !payload.consentimento_contato ||
      !payload.aceite_privacidade
    ) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers });
    }

    try {
      const result = await createAirtableRecord(payload, env);
      return Response.json({ ok: true, airtable: result }, { status: 200, headers });
    } catch (error) {
      return Response.json(
        { error: "Could not create lead", detail: String(error.message || error) },
        { status: 502, headers },
      );
    }
  },
};
