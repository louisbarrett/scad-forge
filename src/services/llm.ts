// LLM Service - OpenAI Compatible API (Ollama default)

import type { LLMConfig, ChatMessage } from '../types';

// Default configuration for Ollama
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2-vision',
  temperature: 0.7,
  maxTokens: 4096,
  autoApply: false,
  autoRender: true,
};

// System prompt for OpenSCAD assistance - CODE ONLY, no explanations
const SYSTEM_PROMPT = `You are an OpenSCAD code generator. Output ONLY code, no explanations.

RULES:
1. Output ONLY a single \`\`\`openscad code block
2. NO explanations, NO descriptions, NO comments about changes
3. Output the COMPLETE modified code
4. Preserve existing variables and modules unless asked to change them

CONSTRAINTS:
- Print: 220×220×220mm
- clearance_loose: 0.4mm, clearance_press: 0.15mm
- M3 clearance: 3.4mm, M3 insert: 4.0mm

Example response format:
\`\`\`openscad
// code here
\`\`\``;

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMService {
  private config: LLMConfig;
  private abortController: AbortController | null = null;

  constructor(config: LLMConfig = DEFAULT_LLM_CONFIG) {
    this.config = config;
  }

  updateConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private buildMessages(
    chatHistory: ChatMessage[],
    currentCode: string,
    imageDataUrl?: string
  ): ChatCompletionMessage[] {
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add chat history
    for (const msg of chatHistory) {
      if (msg.role === 'system') continue;

      // Check if this message has attached context
      if (msg.role === 'user' && (msg.attachedCode || msg.attachedImage)) {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        // Add image if present
        if (msg.attachedImage) {
          content.push({
            type: 'image_url',
            image_url: { url: msg.attachedImage },
          });
        }

        // Build text content
        let textContent = msg.content;
        if (msg.attachedCode) {
          textContent = `Current OpenSCAD code:\n\`\`\`openscad\n${msg.attachedCode}\n\`\`\`\n\n${msg.content}`;
        }
        content.push({ type: 'text', text: textContent });

        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return messages;
  }

  async *streamChat(
    chatHistory: ChatMessage[],
    currentCode: string,
    imageDataUrl?: string
  ): AsyncGenerator<string, void, unknown> {
    this.abortController = new AbortController();

    const messages = this.buildMessages(chatHistory, currentCode, imageDataUrl);

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as ChatCompletionChunk;
            const content = json.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      this.abortController = null;
    }
  }

  async chat(
    chatHistory: ChatMessage[],
    currentCode: string,
    imageDataUrl?: string
  ): Promise<string> {
    this.abortController = new AbortController();

    const messages = this.buildMessages(chatHistory, currentCode, imageDataUrl);

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return data.choices[0]?.message?.content || '';
    } finally {
      this.abortController = null;
    }
  }
}

// Extract OpenSCAD code from LLM response
export function extractCodeFromResponse(response: string): string | null {
  // Look for ```openscad code blocks
  const openscadMatch = response.match(/```openscad\n([\s\S]*?)```/);
  if (openscadMatch) {
    return openscadMatch[1].trim();
  }

  // Fallback: look for any code block
  const codeMatch = response.match(/```\n?([\s\S]*?)```/);
  if (codeMatch) {
    return codeMatch[1].trim();
  }

  return null;
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

export function resetLLMService(config?: LLMConfig) {
  llmServiceInstance = new LLMService(config);
  return llmServiceInstance;
}

