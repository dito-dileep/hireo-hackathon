export type Question = {
  id: string;
  prompt: string;
  expected: string;
  candidate: string;
  category: "technical" | "reasoning" | "extra";
};

export type AiAssessment = {
  overallScore: number;
  technicalScore?: number | null;
  reasoningScore?: number | null;
  perQuestion: { id: string; score: number; correct: boolean; rationale: string }[];
  summary: string;
};

export async function gradeAllQuestions(
  questions: Question[],
): Promise<AiAssessment | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "assessment_grading",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            overallScore: { type: "number" },
            technicalScore: { type: ["number", "null"] },
            reasoningScore: { type: ["number", "null"] },
            perQuestion: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  score: { type: "number" },
                  correct: { type: "boolean" },
                  rationale: { type: "string" },
                },
                required: ["id", "score", "correct", "rationale"],
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
          "You are grading hiring assessment answers. Use semantic understanding: if the logic matches the expected answer, mark correct even if phrased differently. Score each question 0-100. Provide a brief rationale.",
      },
      {
        role: "user",
        content: JSON.stringify({ questions }),
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
    return parsed as AiAssessment;
  } catch {
    return null;
  }
}
