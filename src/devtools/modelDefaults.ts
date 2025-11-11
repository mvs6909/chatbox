import { AIProvider } from './types';

// Fallback model lists for when API fetching fails or is unavailable
export const FALLBACK_MODELS: Record<AIProvider, string[]> = {
    [AIProvider.OpenAI]: [
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
    ],
    [AIProvider.Anthropic]: [
        'claude-sonnet-4-20250514',
        'claude-opus-3-20240229',
        'claude-sonnet-3-5-20240620',
        'claude-haiku-3-20240307',
    ],
    [AIProvider.OpenAICompatible]: [
        // For custom endpoints, allow any model name
        'custom-model',
    ],
};

// Default model for each provider
export const DEFAULT_MODELS: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: 'gpt-3.5-turbo',
    [AIProvider.Anthropic]: 'claude-sonnet-3-5-20240620',
    [AIProvider.OpenAICompatible]: 'custom-model',
};

// Default API hosts for each provider
export const DEFAULT_API_HOSTS: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: 'https://api.openai.com',
    [AIProvider.Anthropic]: 'https://api.anthropic.com',
    [AIProvider.OpenAICompatible]: 'https://api.openai.com',
};

export function getDefaultModelForProvider(provider: AIProvider): string {
    return DEFAULT_MODELS[provider] || 'gpt-3.5-turbo';
}

export function getDefaultHostForProvider(provider: AIProvider): string {
    return DEFAULT_API_HOSTS[provider] || 'https://api.openai.com';
}

export function getFallbackModelsForProvider(provider: AIProvider): string[] {
    return FALLBACK_MODELS[provider] || FALLBACK_MODELS[AIProvider.OpenAI];
}
