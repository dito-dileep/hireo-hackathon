export type AiQuestion = {
  id: string;
  prompt: string;
  type: "short" | "text" | "code";
  expected: string;
};

export async function generateAiQuestions(input: {
  resumeText: string;
  requiredSkills: string[];
  roleTitle?: string;
  count?: number;
}): Promise<AiQuestion[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ai_questions",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  prompt: { type: "string" },
                  type: { type: "string", enum: ["short", "text", "code"] },
                  expected: { type: "string" },
                },
                required: ["id", "prompt", "type", "expected"],
              },
            },
          },
          required: ["questions"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You are generating hiring assessment questions. Use the resume text and required skills to create targeted, fair questions. Return JSON only. Keep prompts concise and professional.",
      },
      {
        role: "user",
        content: JSON.stringify({
          resumeText: input.resumeText.slice(0, 4000),
          requiredSkills: input.requiredSkills || [],
          roleTitle: input.roleTitle || "",
          count: input.count || 3,
        }),
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    try {
      const errText = await res.text();
      console.error("AI question API error:", res.status, errText);
    } catch {
      console.error("AI question API error:", res.status);
    }
    return null;
  }
  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent
            .map((part: any) =>
              typeof part === "string" ? part : (part?.text ?? ""),
            )
            .join("")
        : data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!text) return null;

  try {
    const cleaned = String(text)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;
    const questions = parsed.questions as AiQuestion[];
    if (!Array.isArray(questions)) return null;
    return questions.filter(
      (q) =>
        q &&
        typeof q.id === "string" &&
        typeof q.prompt === "string" &&
        typeof q.expected === "string" &&
        (q.type === "short" || q.type === "text" || q.type === "code"),
    );
  } catch (err) {
    console.error("AI question parse error:", err, text);
    return null;
  }
}
