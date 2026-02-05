type GradeInput = {
  questions: string[];
  expectedAnswers: string[];
  candidateAnswers: string[];
};

export type GradeResult = {
  overallScore: number;
  perQuestion: { score: number; rationale: string }[];
  summary: string;
};

export async function gradeExtraQuestions(
  input: GradeInput,
): Promise<GradeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "extra_question_grading",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            overallScore: { type: "number" },
            perQuestion: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  score: { type: "number" },
                  rationale: { type: "string" },
                },
                required: ["score", "rationale"],
              },
            },
            summary: { type: "string" },
          },
          required: ["overallScore", "perQuestion", "summary"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You grade candidate answers against expected answers. Be strict but fair. Score each question 0-100 by semantic match. Provide a brief rationale.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
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

  if (!res.ok) return null;
  const data = await res.json();
  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as GradeResult;
  } catch {
    return null;
  }
}
