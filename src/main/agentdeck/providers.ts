import type { ProviderConfig } from './types';

const now = () => new Date().toISOString();

export function defaultProviders(): ProviderConfig[] {
  return [
    {
      id: 'ollama',
      name: 'Ollama Local',
      type: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      availableModels: [],
      defaultModel: undefined,
      isDefault: true,
      supportsOpenAICompatibleApi: true,
      status: 'configured',
      updatedAt: now(),
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      type: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKeyEnvVar: 'OPENROUTER_API_KEY',
      availableModels: [],
      defaultModel: 'openai/gpt-4o-mini',
      supportsOpenAICompatibleApi: true,
      status: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing-api-key',
      updatedAt: now(),
    },
    {
      id: 'custom-openai',
      name: 'Custom OpenAI-Compatible',
      type: 'openai-compatible',
      baseUrl: 'http://localhost:8000/v1',
      apiKeyEnvVar: 'CUSTOM_OPENAI_API_KEY',
      availableModels: [],
      supportsOpenAICompatibleApi: true,
      status: 'unconfigured',
      updatedAt: now(),
    },
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      availableModels: [],
      defaultModel: 'gpt-4o-mini',
      supportsOpenAICompatibleApi: true,
      status: process.env.OPENAI_API_KEY ? 'configured' : 'missing-api-key',
      updatedAt: now(),
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      availableModels: [],
      supportsOpenAICompatibleApi: false,
      status: 'unconfigured',
      updatedAt: now(),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      type: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      availableModels: [],
      supportsOpenAICompatibleApi: false,
      status: 'unconfigured',
      updatedAt: now(),
    },
  ];
}

export function normalizeProvider(input: Partial<ProviderConfig> & { id?: string; name?: string; type?: ProviderConfig['type'] }): ProviderConfig {
  if (!input.name) throw new Error('Provider name is required');
  if (!input.type) throw new Error('Provider type is required');
  const id = input.id || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new Error('Provider id is required');
  const supportsOpenAICompatibleApi = input.supportsOpenAICompatibleApi ?? ['ollama', 'openrouter', 'openai-compatible', 'openai'].includes(input.type);
  const apiKeyEnvVar = normalizeEnvVarName(input.apiKeyEnvVar);
  const status = input.status || (apiKeyEnvVar && !process.env[apiKeyEnvVar] && input.type !== 'ollama' ? 'missing-api-key' : 'configured');
  return {
    id,
    name: input.name,
    type: input.type,
    baseUrl: input.baseUrl || defaultBaseUrl(input.type),
    apiKeyEnvVar,
    availableModels: input.availableModels || [],
    defaultModel: input.defaultModel,
    supportsOpenAICompatibleApi,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function redactProvider(provider: ProviderConfig): ProviderConfig {
  return { ...provider, apiKeyEnvVar: provider.apiKeyEnvVar || undefined };
}

function normalizeEnvVarName(value?: string): string | undefined {
  const envVar = value?.trim();
  if (!envVar) return undefined;
  if (!/^[A-Z_][A-Z0-9_]*$/.test(envVar)) throw new Error('apiKeyEnvVar must be an environment variable name, not a raw secret');
  return envVar;
}

function defaultBaseUrl(type: ProviderConfig['type']): string {
  if (type === 'ollama') return 'http://localhost:11434/v1';
  if (type === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (type === 'openai') return 'https://api.openai.com/v1';
  if (type === 'anthropic') return 'https://api.anthropic.com';
  if (type === 'gemini') return 'https://generativelanguage.googleapis.com';
  return '';
}
