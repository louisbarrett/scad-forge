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
const PLANNING_SYSTEM_PROMPT = `You are an expert OpenSCAD code generator. Your task is to generate or modify OpenSCAD code using Constructive Solid Geometry (CSG) operations.

CRITICAL RULES:
1. ALWAYS output your code in a \`\`\`openscad code block
2. Output the COMPLETE modified code, not just snippets
3. Keep explanations minimal - focus on the code
4. Preserve existing variables and modules unless asked to change them

OPENSCAD TECHNIQUES:

1. GEOMETRIC PRIMITIVES - Fundamental building blocks:
   - cube([x,y,z]) or cube(size, center=true) - rectangular prism
   - sphere(r) or sphere(d=diameter) - sphere
   - cylinder(h, r1, r2) or cylinder(h, d=diameter, center=true) - cylinder/cone
   - square([x,y], center=true) - 2D rectangle
   - circle(r) or circle(d=diameter) - 2D circle
   - polygon(points) - 2D polygon from points

2. TRANSFORMATIONS - Position, orientation, and scale:
   - translate([x,y,z]) - move object
   - rotate([x,y,z]) or rotate(a, v=[x,y,z]) - rotate around axes
   - scale([x,y,z]) - scale along axes
   - mirror([x,y,z]) - mirror across plane
   - multmatrix(m) - apply 4x4 transformation matrix
   - color("name") or color([r,g,b,a]) - set color

3. BOOLEAN OPERATIONS (CSG) - Combine shapes:
   - union() { } - combine multiple shapes
   - difference() { } - subtract subsequent shapes from first
   - intersection() { } - keep only overlapping volume

4. ADVANCED OPERATIONS:
   - linear_extrude(height, twist, slices, scale) - extrude 2D to 3D
   - rotate_extrude(angle, $fn) - revolve 2D shape around Z axis
   - hull() { } - create convex hull around objects
   - minkowski() { } - Minkowski sum (round edges, offsets)
   - offset(r, delta, chamfer) - 2D offset/inset
   - projection(cut) - project 3D to 2D

5. MODULES AND FUNCTIONS:
   - module name(params) { } - reusable geometry blocks
   - function name(params) = expr; - computational functions
   - children() - reference child objects in modules
   - for (i = [start:step:end]) - iteration loops
   - let (var = expr) - local variable binding
   - Use parameters for all dimensions to enable easy modification

6. SPECIAL VARIABLES - Rendering quality:
   - $fn - number of fragments (higher = smoother curves)
   - $fs - minimum fragment size
   - $fa - minimum fragment angle
   - Use $fn=64 or higher for smooth curves, $fn=6 for hexagons

BEST PRACTICES:
- Parameterize dimensions at the top of the file
- Use modules for repeated geometry
- Comment sections clearly
- Use center=true for symmetric operations
- Apply difference() for holes, slots, and cutouts

FABRICATION CONSTRAINTS:
- 3D Print volume: 220×220×220mm
- clearance_loose: 0.4mm, clearance_press: 0.15mm  
- M3 clearance hole: 3.4mm, M3 heat-set insert: 4.0mm

REQUIRED OUTPUT FORMAT - Always wrap code like this:
\`\`\`openscad
// Your complete OpenSCAD code here
\`\`\``;

// System prompt for chat with vision - still outputs code
const VISION_CHAT_PROMPT = `You are an expert OpenSCAD code generator with vision capabilities. You can see images of 3D models and modify the code accordingly using Constructive Solid Geometry (CSG) operations.

CRITICAL RULES:
1. ALWAYS output your code in a \`\`\`openscad code block
2. Output the COMPLETE modified code, not just snippets
3. When you see an image, analyze it and generate code that achieves the user's request
4. Preserve existing variables and modules unless asked to change them

OPENSCAD TECHNIQUES:

1. GEOMETRIC PRIMITIVES - Fundamental building blocks:
   - cube([x,y,z]) or cube(size, center=true) - rectangular prism
   - sphere(r) or sphere(d=diameter) - sphere
   - cylinder(h, r1, r2) or cylinder(h, d=diameter, center=true) - cylinder/cone
   - square([x,y], center=true) - 2D rectangle
   - circle(r) or circle(d=diameter) - 2D circle
   - polygon(points) - 2D polygon from points

2. TRANSFORMATIONS - Position, orientation, and scale:
   - translate([x,y,z]) - move object
   - rotate([x,y,z]) or rotate(a, v=[x,y,z]) - rotate around axes
   - scale([x,y,z]) - scale along axes
   - mirror([x,y,z]) - mirror across plane
   - color("name") or color([r,g,b,a]) - set color

3. BOOLEAN OPERATIONS (CSG) - Combine shapes:
   - union() { } - combine multiple shapes
   - difference() { } - subtract subsequent shapes from first
   - intersection() { } - keep only overlapping volume

4. ADVANCED OPERATIONS:
   - linear_extrude(height, twist, slices, scale) - extrude 2D to 3D
   - rotate_extrude(angle, $fn) - revolve 2D shape around Z axis
   - hull() { } - create convex hull around objects
   - minkowski() { } - Minkowski sum (round edges, offsets)
   - offset(r, delta, chamfer) - 2D offset/inset
   - projection(cut) - project 3D to 2D

5. MODULES AND FUNCTIONS:
   - module name(params) { } - reusable geometry blocks
   - function name(params) = expr; - computational functions
   - children() - reference child objects in modules
   - for (i = [start:step:end]) - iteration loops
   - Use parameters for all dimensions to enable easy modification

6. SPECIAL VARIABLES - Rendering quality:
   - $fn - number of fragments (higher = smoother curves)
   - $fs - minimum fragment size
   - $fa - minimum fragment angle
   - Use $fn=64 or higher for smooth curves, $fn=6 for hexagons

BEST PRACTICES:
- Parameterize dimensions at the top of the file
- Use modules for repeated geometry
- Comment sections clearly
- Use center=true for symmetric operations
- Apply difference() for holes, slots, and cutouts

FABRICATION CONSTRAINTS:
- 3D Print volume: 220×220×220mm
- clearance_loose: 0.4mm, clearance_press: 0.15mm
- M3 clearance hole: 3.4mm, M3 heat-set insert: 4.0mm

REQUIRED OUTPUT FORMAT - Always wrap code like this:
\`\`\`openscad
// Your complete OpenSCAD code here
\`\`\``;

// System prompt for vision analysis
const VISION_SYSTEM_PROMPT = `You are a 3D CAD design analyst specializing in OpenSCAD. You analyze images of 3D models and describe:
1. The current geometry and features visible
2. What modifications would be needed based on the user's request
3. Specific OpenSCAD operations that could achieve the changes

OPENSCAD OPERATIONS REFERENCE:

Primitives: cube(), sphere(), cylinder(), polygon(), circle(), square()

Transformations: translate(), rotate(), scale(), mirror(), color()

Boolean CSG: union(), difference(), intersection()

Advanced: 
- linear_extrude() - extrude 2D to 3D along Z
- rotate_extrude() - revolve 2D around Z axis
- hull() - convex hull around objects
- minkowski() - round edges, create offsets
- offset() - 2D inset/outset
- projection() - 3D to 2D

Modules: module name() { } for reusable geometry

Special Variables: $fn, $fs, $fa for curve smoothness

Be precise and technical. When suggesting modifications, reference specific OpenSCAD functions and explain how to combine them using CSG operations (union, difference, intersection).`;

// System prompt for error fixing - focused on debugging and correcting OpenSCAD errors
const ERROR_FIX_SYSTEM_PROMPT = `You are an expert OpenSCAD debugger. Your task is to fix broken OpenSCAD code based on compiler error messages.

CRITICAL RULES:
1. ALWAYS output your fixed code in a \`\`\`openscad code block
2. Output the COMPLETE fixed code, not just the changed parts
3. Analyze the error message carefully to identify the root cause
4. Common OpenSCAD errors and fixes:
   - "Unknown module" → Check spelling, ensure module is defined before use
   - "Unknown function" → Check spelling, ensure function is defined
   - "Expected )" → Missing closing parenthesis, check function calls
   - "Expected }" → Missing closing brace, check module/control structures
   - "Expected ;" → Missing semicolon at end of statement
   - "Undefined variable" → Variable not declared or typo in name
   - "Invalid value" → Wrong type passed to function
   - "Too few parameters" → Add missing required parameters
   - "Too many parameters" → Remove extra parameters

FIX STRATEGY:
1. Read the error message and line number
2. Locate the problematic code
3. Apply the minimal fix needed to resolve the error
4. Preserve all working code and functionality
5. Do NOT add new features - only fix the error

REQUIRED OUTPUT FORMAT:
\`\`\`openscad
// Your complete fixed OpenSCAD code here
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
    // But ALWAYS use a code-generation prompt so we get ```openscad blocks
    const hasImage = imageDataUrl || chatHistory.some(m => m.attachedImage);
    const model = hasImage ? this.getModelForTask('vision') : this.getModelForTask('planning');
    const systemPrompt = hasImage ? VISION_CHAT_PROMPT : PLANNING_SYSTEM_PROMPT;
    
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

    // If there's an image, use the vision model, otherwise use planning model
    // But ALWAYS use a code-generation prompt so we get ```openscad blocks
    const hasImage = imageDataUrl || chatHistory.some(m => m.attachedImage);
    const model = hasImage ? this.getModelForTask('vision') : this.getModelForTask('planning');
    const systemPrompt = hasImage ? VISION_CHAT_PROMPT : PLANNING_SYSTEM_PROMPT;
    
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

  /**
   * Attempt to fix broken OpenSCAD code based on error messages
   * @param code The broken OpenSCAD code
   * @param errorMessage The error message from the compiler
   * @returns The LLM's response with the fixed code
   */
  async attemptFix(code: string, errorMessage: string): Promise<string> {
    this.abortController = new AbortController();

    const model = this.getModelForTask('planning');
    
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: ERROR_FIX_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `The following OpenSCAD code has an error. Please fix it.

ERROR MESSAGE:
${errorMessage}

BROKEN CODE:
\`\`\`openscad
${code}
\`\`\`

Please analyze the error and provide the complete fixed code.`
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature: 0.3, // Lower temperature for more precise fixes
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

  /**
   * Stream an attempt to fix broken OpenSCAD code
   * @param code The broken OpenSCAD code
   * @param errorMessage The error message from the compiler
   * @yields Chunks of the LLM response
   */
  async *streamAttemptFix(
    code: string,
    errorMessage: string
  ): AsyncGenerator<string, void, unknown> {
    this.abortController = new AbortController();

    const model = this.getModelForTask('planning');
    
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: ERROR_FIX_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `The following OpenSCAD code has an error. Please fix it.

ERROR MESSAGE:
${errorMessage}

BROKEN CODE:
\`\`\`openscad
${code}
\`\`\`

Please analyze the error and provide the complete fixed code.`
      },
    ];

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature: 0.3,
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
