const PROMPT = `
You are reading a handwritten timesheet from Goku Studio.
Extract all task entries from this image. The physical sheet has columns:
- S.No: row number
- Project: the task description (what was worked on)
- Client (mislabeled — actually means Project/Category): e.g. Digimap, Phaco, Perimeter, Meeting
- Designer: person's name who did the work
- Hours: hours worked

Rules:
1. If the Client/Category column is empty, isInternal = true
2. If Designer says "X persons" or a number, isMeeting = true
3. Meetings appear as "Meeting for [X]" or "Gmeet for [X]"
4. Return ONLY a JSON object. No explanation, no markdown.

Response format:
{
  "date": "YYYY-MM-DD",
  "entries": [
    {
      "rowNumber": 1,
      "taskDescription": "string",
      "projectCategory": "string or null",
      "designer": "string or null",
      "hours": number,
      "isMeeting": boolean,
      "isInternal": boolean,
      "personCount": number or null
    }
  ]
}
`;

export type ExtractedEntry = {
  rowNumber: number;
  taskDescription: string;
  projectCategory: string | null;
  designer: string | null;
  hours: number;
  isMeeting: boolean;
  isInternal: boolean;
  personCount: number | null;
};

export type ExtractedTimesheet = {
  date: string;
  entries: ExtractedEntry[];
};

async function extractWithGemini(
  base64Image: string,
  mimeType: string
): Promise<ExtractedTimesheet> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    {
      inlineData: { data: base64Image, mimeType },
    },
    PROMPT,
  ]);

  const text = result.response.text().trim();
  const json = text.startsWith("```")
    ? text.replace(/```json?\n?/, "").replace(/```$/, "").trim()
    : text;
  return JSON.parse(json);
}

async function extractWithClaude(
  base64Image: string,
  mimeType: string
): Promise<ExtractedTimesheet> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64Image,
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const text = (message.content[0] as { text: string }).text.trim();
  const json = text.startsWith("```")
    ? text.replace(/```json?\n?/, "").replace(/```$/, "").trim()
    : text;
  return JSON.parse(json);
}

async function extractWithOpenAI(
  base64Image: string,
  mimeType: string
): Promise<ExtractedTimesheet> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    max_tokens: 2048,
  });

  const text = response.choices[0].message.content?.trim() ?? "{}";
  const json = text.startsWith("```")
    ? text.replace(/```json?\n?/, "").replace(/```$/, "").trim()
    : text;
  return JSON.parse(json);
}

export async function extractTimesheetFromImage(
  base64Image: string,
  mimeType: string
): Promise<ExtractedTimesheet> {
  const provider = process.env.AI_PROVIDER || "gemini";

  if (provider === "gemini") return extractWithGemini(base64Image, mimeType);
  if (provider === "claude") return extractWithClaude(base64Image, mimeType);
  if (provider === "openai") return extractWithOpenAI(base64Image, mimeType);

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
