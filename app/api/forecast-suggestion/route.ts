import { NextRequest, NextResponse } from "next/server";

type ForecastRow = {
  date: string;
  forecast: number;
  actual: number | null;
  variance: number | null;
  note: string;
};

type ForecastRequestBody = {
  productName: string;
  method: string;
  horizon: number;
  reorderLevel: number;
  forecastRows: ForecastRow[];
};

const GROQ_URL = process.env.GROQ_API_URL || "https://api.groq.com/v1/responses";
const GROQ_MODEL = process.env.GROQ_MODEL || "grok-1.0";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function buildPrompt(body: ForecastRequestBody) {
  const rowsText = body.forecastRows
    .map((row) => `${row.date}: forecast ${row.forecast}, actual ${row.actual ?? "N/A"}, variance ${row.variance ?? "N/A"}`)
    .join("\n");

  return `You are a supply chain forecasting assistant. Provide guidance for the product: ${body.productName}. The forecast method is ${body.method} and the horizon is ${body.horizon} days.

Make the output easy to read, include a short overall summary, and then give month-level or date-range suggestions for inventory planning. Mention whether the forecast suggests ordering early, monitoring inventory, or adjusting safety stock. Keep the response in plain text and include month-specific guidance if possible.

Reorder level: ${body.reorderLevel}.

Forecast rows:
${rowsText}

Return the suggestions in a friendly, actionable style with bullet points or short paragraphs.`;
}

export async function POST(req: NextRequest) {
  const groqApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const apiKey = groqApiKey || openAiApiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY or OPENAI_API_KEY in server environment." },
      { status: 500 },
    );
  }

  const isGroq = Boolean(groqApiKey);
  const apiUrl = isGroq ? GROQ_URL : OPENAI_URL;
  const model = isGroq ? GROQ_MODEL : OPENAI_MODEL;

  let body: ForecastRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.productName || !body.horizon || !Array.isArray(body.forecastRows)) {
    return NextResponse.json({ error: "Missing required forecast request fields." }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const message = errorJson?.error?.message || `AI service error: ${response.status}`;
    const help = message.includes("model_not_found")
      ? isGroq
        ? `Model ${model} does not exist for your Groq key. Try setting GROQ_MODEL=grok-1.0 in .env or use a valid Groq model name.`
        : `Model ${model} does not exist for your OpenAI key. Try setting OPENAI_MODEL=gpt-4o-mini in .env or use a valid OpenAI model name.`
      : message;

    return NextResponse.json({ error: help }, { status: 502 });
  }

  const json = await response.json();
  const output = Array.isArray(json.output) ? json.output : [];
  const content = output[0]?.content ?? [];
  const textItem = Array.isArray(content) ? content.find((item: any) => item.type === "output_text") ?? content[0] : null;
  const suggestion = textItem?.text ?? (typeof content === "string" ? content : "No suggestions returned.");

  return NextResponse.json({ suggestion: String(suggestion).trim() });
}
