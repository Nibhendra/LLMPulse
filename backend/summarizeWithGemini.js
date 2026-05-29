const { GoogleGenAI } = require('@google/genai');

/**
 * Summarizes the news article using the Gemini API and outputs structured data.
 * @param {string} title - The original article title
 * @param {string} content - The content/body of the article
 * @param {object} sourceInfo - Info about the source (category, tool, company)
 * @returns {Promise<object>} - The structured summary object
 */
async function summarizeWithGemini(title, content, sourceInfo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are an expert AI Researcher and News Editor.
Analyze the following article title and content.
Original Title: "${title}"
Original Content: "${content.substring(0, 10000)}" // Limit content length just in case

Generate a structured JSON output summarizing this update.
Categorize it into one of these strict categories:
"Claude", "Gemini", "OpenAI", "Hugging Face", "AI Coding Tools", "Open Source Models".
Default Company: ${sourceInfo.company}
Default Tool: ${sourceInfo.category}

Ensure the "importanceScore" is a number between 1 (low significance) and 10 (industry-changing breakthrough).
"beginnerExplanation" should explain the update in simple terms for a non-tech person.
"developerExplanation" should focus on the technical details, APIs, or model architecture details relevant to engineers.
"whyItMatters" should explain the market/industry impact of this update.
"tags" should be an array of relevant search tags (e.g. ["multimodal", "fine-tuning", "agent"]).
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'A clean, simplified title for the update' },
            tool: { type: 'STRING', description: 'The specific model or tool (e.g., Claude 3.5 Sonnet, Gemini 1.5 Pro, GPT-4o, Cursor)' },
            company: { type: 'STRING', description: 'The company behind the tool (e.g., Anthropic, Google, OpenAI, Hugging Face)' },
            category: { 
              type: 'STRING', 
              description: 'Must be exactly one of: Claude, Gemini, OpenAI, Hugging Face, AI Coding Tools, Open Source Models' 
            },
            summary: { type: 'STRING', description: 'A highly concise 2-3 sentence overview of the update' },
            whyItMatters: { type: 'STRING', description: 'Why this update is significant for the AI ecosystem' },
            beginnerExplanation: { type: 'STRING', description: 'Simple, non-technical explanation' },
            developerExplanation: { type: 'STRING', description: 'Highly technical developer-focused explanation' },
            importanceScore: { type: 'INTEGER', description: 'Importance rating from 1 to 10' },
            tags: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of relevant keywords'
            }
          },
          required: [
            'title', 'tool', 'company', 'category', 'summary',
            'whyItMatters', 'beginnerExplanation', 'developerExplanation',
            'importanceScore', 'tags'
          ]
        }
      }
    });

    const responseText = response.text;
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error summarizing with Gemini:", error);
    throw error;
  }
}

module.exports = { summarizeWithGemini };
