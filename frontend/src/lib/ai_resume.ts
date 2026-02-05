export type AiResumeMatch = {
  matchedSkills: string[];
  missingSkills: string[];
  confidence: number;
  summary: string;
};

export async function aiMatchResumeSkills(input: {
  resumeText: string;
  requiredSkills: string[];
}): Promise<AiResumeMatch | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!input.requiredSkills.length) return null;

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "resume_skill_match",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            matchedSkills: { type: "array", items: { type: "string" } },
            missingSkills: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
            summary: { type: "string" },
          },
          required: ["matchedSkills", "missingSkills", "confidence", "summary"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You compare a resume excerpt against required skills. Match skills case-insensitively and by semantic equivalence (e.g., 'Java' vs 'JAVA', 'JS' vs 'JavaScript'). Return matchedSkills and missingSkills from the required list only.",
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
    return parsed as AiResumeMatch;
  } catch {
    return null;
  }
}
