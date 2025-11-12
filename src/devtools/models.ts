import { AIProvider } from './types';
import { getFallbackModelsForProvider } from './modelDefaults';

// Cache structure
interface ModelCache {
    models: string[];
    timestamp: number;
    provider: AIProvider;
    apiKey: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let modelCache: ModelCache | null = null;

/**
 * Fetch available models from OpenAI API
 */
async function fetchOpenAIModels(apiHost: string, apiKey: string): Promise<string[]> {
    const response = await fetch(`${apiHost}/v1/models`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for chat models only (gpt-* models)
    const allModels = data.data.map((model: any) => model.id);
    const chatModels = allModels.filter((id: string) =>
        id.includes('gpt') || id.includes('turbo')
    );

    return chatModels.length > 0 ? chatModels : allModels;
}

/**
 * Fetch available models from Anthropic API
 */
async function fetchAnthropicModels(apiHost: string, apiKey: string): Promise<string[]> {
    const response = await fetch(`${apiHost}/v1/models`, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((model: any) => model.id);
}

/**
 * Fetch available models from OpenAI-compatible API
 */
async function fetchCompatibleModels(apiHost: string, apiKey: string): Promise<string[]> {
    try {
        // Try OpenAI format first
        const response = await fetch(`${apiHost}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((model: any) => model.id);
        }

        throw new Error('Invalid response format');
    } catch (error) {
        // If fetching fails, return fallback
        console.warn('Failed to fetch models from compatible API:', error);
        throw error;
    }
}

/**
 * Main function to fetch models based on provider
 */
export async function fetchModels(
    provider: AIProvider,
    apiHost: string,
    apiKey: string,
    useCache = true
): Promise<{ models: string[]; fromCache: boolean; error?: string }> {
    // Check cache first
    if (useCache && modelCache) {
        const isCacheValid =
            modelCache.provider === provider &&
            modelCache.apiKey === apiKey &&
            Date.now() - modelCache.timestamp < CACHE_DURATION;

        if (isCacheValid) {
            return { models: modelCache.models, fromCache: true };
        }
    }

    // Validate inputs
    if (!apiKey || apiKey.trim() === '') {
        return {
            models: getFallbackModelsForProvider(provider),
            fromCache: false,
            error: 'No API key provided. Using default models.',
        };
    }

    try {
        let models: string[];

        switch (provider) {
            case AIProvider.OpenAI:
                models = await fetchOpenAIModels(apiHost, apiKey);
                break;
            case AIProvider.Anthropic:
                models = await fetchAnthropicModels(apiHost, apiKey);
                break;
            case AIProvider.OpenAICompatible:
                models = await fetchCompatibleModels(apiHost, apiKey);
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        // Cache the results
        modelCache = {
            models,
            timestamp: Date.now(),
            provider,
            apiKey,
        };

        return { models, fromCache: false };
    } catch (error) {
        console.error('Error fetching models:', error);
        const fallbackModels = getFallbackModelsForProvider(provider);
        return {
            models: fallbackModels,
            fromCache: false,
            error: error instanceof Error ? error.message : 'Failed to fetch models',
        };
    }
}

/**
 * Clear the model cache (useful when API key or host changes)
 */
export function clearModelCache(): void {
    modelCache = null;
}

/**
 * Check if cache is valid for the given parameters
 */
export function isCacheValid(provider: AIProvider, apiKey: string): boolean {
    if (!modelCache) return false;

    return (
        modelCache.provider === provider &&
        modelCache.apiKey === apiKey &&
        Date.now() - modelCache.timestamp < CACHE_DURATION
    );
}
