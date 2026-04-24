import { GoogleGenAI } from '@google/genai';
import { websiteKnowledge } from '../ai/websiteKnowledge';

export interface ChatbotRequestContext {
  userId: string;
  roleName: string;
  permissionNames: string[];
  currentPath?: string;
  currentPageTitle?: string;
}

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const client = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

export const isGeminiConfigured = (): boolean => Boolean(client);

const buildPrompt = (question: string, context: ChatbotRequestContext) => `
${websiteKnowledge}

Current user context:
- User ID: ${context.userId}
- Role: ${context.roleName}
- Permissions: ${context.permissionNames.length > 0 ? context.permissionNames.join(', ') : 'none listed'}
- Current route: ${context.currentPath || 'unknown'}
- Current page title: ${context.currentPageTitle || 'unknown'}

Response rules:
- Answer as the website assistant only.
- Use the current route and role context when helpful.
- If the user asks for a task to be performed, explain that this MVP assistant can only answer questions about the website for now.
- If you mention navigation, prefer the exact route or page name when known.
- If uncertain, say what you are not sure about instead of guessing.

User question:
${question}
`.trim();

export const generateWebsiteHelpAnswer = async (
  question: string,
  context: ChatbotRequestContext
): Promise<string> => {
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const response = await client.models.generateContent({
    model: geminiModel,
    contents: buildPrompt(question, context),
    config: {
      thinkingConfig: {
        thinkingBudget: 0
      },
      maxOutputTokens: 400
    }
  });

  return (response.text || '').trim();
};
