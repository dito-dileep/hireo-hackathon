export type AiQuestion = {
  id: string;
  prompt: string;
  type: "short" | "text" | "code";
  expected: string;
};

function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");
}

function pickResumeSkills(resumeText: string, requiredSkills: string[]) {
  const norm = normalizeText(resumeText);
  const required = requiredSkills
    .map((s) => String(s).trim())
    .filter(Boolean);
  const matched = required.filter((skill) => {
    const token = normalizeText(skill).trim();
    return token && norm.includes(token);
  });
  if (matched.length > 0) return matched.slice(0, 3);

  const commonSkills = [
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "nextjs",
    "node",
    "sql",
    "mongodb",
    "html",
    "css",
    "c",
    "c++",
  ];
  return commonSkills.filter((skill) => norm.includes(normalizeText(skill))).slice(0, 3);
}

function buildFallbackQuestions(input: {
  resumeText: string;
  requiredSkills: string[];
  roleTitle?: string;
  count?: number;
}): AiQuestion[] {
  const skills = pickResumeSkills(input.resumeText, input.requiredSkills);
  const role = input.roleTitle || "the role";
  const desiredCount = Math.max(1, Math.min(input.count || 3, 5));
  const questions: AiQuestion[] = [];

  skills.forEach((skill, idx) => {
    questions.push({
      id: `fallback-skill-${idx + 1}`,
      prompt: `Explain how you would use ${skill} in ${role}. Mention one practical scenario and one challenge.`,
      type: "text",
      expected: `A strong answer should clearly explain ${skill}, relate it to ${role}, include a practical use case, and mention at least one realistic challenge or tradeoff.`,
    });
  });

  if (questions.length < desiredCount) {
    questions.push({
      id: "fallback-project-1",
      prompt: `Describe one project from your resume that best matches ${role}. What was your contribution, tech stack, and measurable outcome?`,
      type: "text",
      expected: "A strong answer should describe a relevant project, the candidate's concrete contribution, technologies used, and a measurable outcome or impact.",
    });
  }

  if (questions.length < desiredCount) {
    questions.push({
      id: "fallback-debug-1",
      prompt: `You are given a bug in ${role}. Walk through your debugging process step by step.`,
      type: "text",
      expected: "A strong answer should cover reproducing the issue, isolating the cause, checking logs or data, applying a fix, testing the fix, and verifying no regressions.",
    });
  }

  if (questions.length < desiredCount) {
    const skill = skills[0] || input.requiredSkills[0] || "programming";
    questions.push({
      id: "fallback-code-1",
      prompt: `Write a short ${skill}-related solution or pseudocode relevant to ${role}. Keep it simple but correct.`,
      type: "code",
      expected: `A strong answer should show correct logic, readable structure, and basic relevance to ${skill} and ${role}.`,
    });
  }

  return questions.slice(0, desiredCount);
}

export async function generateAiQuestions(input: {
  resumeText: string;
  requiredSkills: string[];
  roleTitle?: string;
  count?: number;
}): Promise<AiQuestion[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallbackQuestions(input);

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
    return buildFallbackQuestions(input);
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
  if (!text) return buildFallbackQuestions(input);

  try {
    const cleaned = String(text)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return buildFallbackQuestions(input);
    const questions = parsed.questions as AiQuestion[];
    if (!Array.isArray(questions)) return buildFallbackQuestions(input);
    const filtered = questions.filter(
      (q) =>
        q &&
        typeof q.id === "string" &&
        typeof q.prompt === "string" &&
        typeof q.expected === "string" &&
        (q.type === "short" || q.type === "text" || q.type === "code"),
    );
    return filtered.length > 0 ? filtered : buildFallbackQuestions(input);
  } catch (err) {
    console.error("AI question parse error:", err, text);
    return buildFallbackQuestions(input);
  }
}
