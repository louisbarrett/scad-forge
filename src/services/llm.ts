// LLM Service - OpenAI Compatible API (Ollama default)
// Supports dual-model architecture: Planning + Vision

import type { LLMConfig, ChatMessage } from '../types';

// Default configuration for Ollama with dual models
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2-vision', // Legacy fallback
  planningModel: 'qwen2.5-coder:14b', // For code generation
  visionModel: 'llama3.2-vision', // For image analysis
  temperature: 0.7,
  maxTokens: 4096,
  autoApply: false,
  autoRender: true,
};

// System prompt for OpenSCAD code generation - CODE ONLY, no explanations
const PLANNING_SYSTEM_PROMPT = `You are an OpenSCAD code generator. Output ONLY code, no explanations.

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

// System prompt for vision analysis
const VISION_SYSTEM_PROMPT = `You are a 3D CAD design analyst. You analyze images of 3D models and describe:
1. The current geometry and features visible
2. What modifications would be needed based on the user's request
3. Specific OpenSCAD operations that could achieve the changes

Be precise and technical. Focus on actionable modifications.`;

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

  // Get the active model for a given task type
  getModelForTask(task: 'planning' | 'vision' | 'chat'): string {
    switch (task) {
      case 'planning':
        return this.config.planningModel || this.config.model;
      case 'vision':
        return this.config.visionModel || this.config.model;
      case 'chat':
      default:
        return this.config.model;
    }
  }

  private buildMessages(
    chatHistory: ChatMessage[],
    _currentCode: string,
    _imageDataUrl?: string,
    systemPrompt: string = PLANNING_SYSTEM_PROMPT
  ): ChatCompletionMessage[] {
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
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

  // Vision analysis: analyze an image and describe modifications
  async analyzeImage(
    imageDataUrl: string,
    userPrompt: string,
    currentCode: string
  ): Promise<string> {
    this.abortController = new AbortController();

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageDataUrl },
          },
          {
            type: 'text',
            text: `Current OpenSCAD code:
\`\`\`openscad
${currentCode}
\`\`\`

User request: ${userPrompt}

Analyze the image and describe what modifications are needed to achieve the user's request. Be specific about OpenSCAD operations.`,
          },
        ],
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.getModelForTask('vision'),
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
        throw new Error(`Vision API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return data.choices[0]?.message?.content || '';
    } finally {
      this.abortController = null;
    }
  }

  // Generate code based on vision analysis
  async generateCodeFromAnalysis(
    visionAnalysis: string,
    userPrompt: string,
    currentCode: string
  ): Promise<string> {
    this.abortController = new AbortController();

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: PLANNING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Current OpenSCAD code:
\`\`\`openscad
${currentCode}
\`\`\`

Visual analysis of the current model:
${visionAnalysis}

User request: ${userPrompt}

Generate the complete modified OpenSCAD code that implements the requested changes.`,
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.getModelForTask('planning'),
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
        throw new Error(`Planning API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return data.choices[0]?.message?.content || '';
    } finally {
      this.abortController = null;
    }
  }

  // Full vision mutation pipeline: Vision → Planning → Code
  async *streamVisionMutation(
    imageDataUrl: string,
    userPrompt: string,
    currentCode: string,
    onVisionComplete?: (analysis: string) => void
  ): AsyncGenerator<{ type: 'vision' | 'planning'; content: string }, void, unknown> {
    // Step 1: Vision analysis
    yield { type: 'vision', content: '🔍 Analyzing image with vision model...\n' };
    
    const visionAnalysis = await this.analyzeImage(imageDataUrl, userPrompt, currentCode);
    
    if (onVisionComplete) {
      onVisionComplete(visionAnalysis);
    }
    
    yield { type: 'vision', content: visionAnalysis + '\n\n' };
    yield { type: 'planning', content: '⚙️ Generating code with planning model...\n\n' };

    // Step 2: Code generation (streaming)
    this.abortController = new AbortController();

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: PLANNING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Current OpenSCAD code:
\`\`\`openscad
${currentCode}
\`\`\`

Visual analysis of the current model:
${visionAnalysis}

User request: ${userPrompt}

Generate the complete modified OpenSCAD code that implements the requested changes.`,
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.getModelForTask('planning'),
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
        throw new Error(`Planning API error: ${response.status} - ${errorText}`);
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
              yield { type: 'planning', content };
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

  async *streamChat(
    chatHistory: ChatMessage[],
    currentCode: string,
    imageDataUrl?: string
  ): AsyncGenerator<string, void, unknown> {
    this.abortController = new AbortController();

    // If there's an image, use the vision model, otherwise use planning model
    const hasImage = imageDataUrl || chatHistory.some(m => m.attachedImage);
    const model = hasImage ? this.getModelForTask('vision') : this.getModelForTask('planning');
    const systemPrompt = hasImage ? VISION_SYSTEM_PROMPT : PLANNING_SYSTEM_PROMPT;
    
    const messages = this.buildMessages(chatHistory, currentCode, imageDataUrl, systemPrompt);

    const requestBody: ChatCompletionRequest = {
      model,
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

    const hasImage = imageDataUrl || chatHistory.some(m => m.attachedImage);
    const model = hasImage ? this.getModelForTask('vision') : this.getModelForTask('planning');
    const systemPrompt = hasImage ? VISION_SYSTEM_PROMPT : PLANNING_SYSTEM_PROMPT;
    
    const messages = this.buildMessages(chatHistory, currentCode, imageDataUrl, systemPrompt);

    const requestBody: ChatCompletionRequest = {
      model,
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
