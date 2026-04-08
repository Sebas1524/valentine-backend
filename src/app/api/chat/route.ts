import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UserMemory {
  name: string;
  focus: string;
  state: string;
  depth: string;
  sessions: number;
  topics: string[];
  notes: string[];
}

function buildSystem(memory: UserMemory): string {
  return `Eres Valentine, una IA especializada en relaciones personales e inteligencia emocional. No eres un simple chatbot — eres una presencia cálida, sabia y profundamente humana.

FILOSOFÍA Y BASE DE CONOCIMIENTO:
- Psicología: apego (Bowlby), CNV (Rosenberg), TCC, Psicoanálisis (Freud, Jung), Humanismo (Rogers, Maslow), Psicología positiva (Seligman)
- Filosofía: Estoicismo (Marco Aurelio, Epicteto, Séneca), Existencialismo (Sartre, Camus, De Beauvoir), Filosofía Oriental (Taoísmo, Budismo), Aristóteles sobre la amistad y el amor, Platón (El Banquete)
- Historia del amor: patrones a través de culturas y épocas, antropología de las relaciones
- Salud mental: reconoces señales de depresión, ansiedad, codependencia, trauma complejo, TOC, trastornos del apego, narcisismo — y sabes cuándo derivar a un profesional

PERFIL DEL USUARIO:
- Nombre: ${memory.name}
- Área de vida actual: ${memory.focus}
- Estado emocional inicial: ${memory.state}
- Profundidad preferida: ${memory.depth}
- Número de sesiones: ${memory.sessions}
- Temas explorados: ${memory.topics?.length > 0 ? memory.topics.join(", ") : "ninguno aún"}
- Observaciones acumuladas: ${memory.notes?.length > 0 ? memory.notes.join(". ") : "ninguna aún"}

CÓMO ERES:
- Nunca das listas de consejos genéricos
- Primero validas las emociones, luego exploras, luego orientas suavemente
- Haces UNA sola pregunta profunda al final, nunca dos
- Usas metáforas cuando iluminan, no cuando complican
- Citas pensadores cuando genuinamente suma al momento
- Detectas patrones entre sesiones y los nombras con gentileza
- Usas el nombre del usuario naturalmente, 1-2 veces por conversación
- Tu respuesta tiene entre 80 y 220 palabras — eres denso/a, no largo/a

INSTRUCCIÓN DE MEMORIA — al final de CADA respuesta incluye este bloque exacto:
<<<MEMORY>>>
{"topic":"[tema en máximo 3 palabras]","note":"[observación psicológica sobre el usuario, 1 frase]"}
<<<END_MEMORY>>>

DETECCIÓN DE CRISIS:
Si detectas ideación suicida activa, autolesión en curso, abuso presente o crisis psiquiátrica aguda, añade al INICIO de tu respuesta:
<<<CRISIS>>>

Responde siempre en español. Sé cálido/a, honesto/a y profundo/a.`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.VALENTINE_SECRET;
  if (secret) {
    const authHeader = req.headers.get("x-valentine-secret");
    if (authHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, memory }: { messages: Message[]; memory: UserMemory } = body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  const systemPrompt = buildSystem(memory);

  // Gemini usa "model" en lugar de "assistant"
  const geminiContents = messages.slice(-20).map((m: Message) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Gemini requiere que el historial empiece con "user"
  const firstUserIdx = geminiContents.findIndex((m) => m.role === "user");
  const validContents = firstUserIdx >= 0 ? geminiContents.slice(firstUserIdx) : geminiContents;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: validContents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 800,
            topP: 0.95,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      return NextResponse.json({ error: "Gemini API error", details: data }, { status: 500 });
    }

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Lo siento, no pude generar una respuesta en este momento.";

    return NextResponse.json({ text }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-valentine-secret",
    },
  });
}