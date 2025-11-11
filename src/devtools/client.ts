import { Configuration, OpenAIApi, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from './openai-node'
import { Message, AIProvider } from './types'

// Provider Adapter Interface
interface ProviderAdapter {
    getEndpoint(host: string): string
    getHeaders(apiKey: string): Record<string, string>
    buildRequestBody(messages: ChatCompletionRequestMessage[], model: string): any
    parseStreamChunk(dataStr: string): string | null
    shouldTerminateStream(chunk: string): boolean
}

// OpenAI Provider Adapter
class OpenAIAdapter implements ProviderAdapter {
    getEndpoint(host: string): string {
        return `${host}/v1/chat/completions`
    }

    getHeaders(apiKey: string): Record<string, string> {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        }
    }

    buildRequestBody(messages: ChatCompletionRequestMessage[], model: string): any {
        return {
            messages: messages,
            model: model,
            stream: true
        }
    }

    parseStreamChunk(dataStr: string): string | null {
        try {
            const json = JSON.parse(dataStr)
            if (json.error) {
                throw new Error(`Error from OpenAI: ${JSON.stringify(json.error)}`)
            }
            return json.choices[0]?.delta?.content
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Error parsing JSON: ${dataStr}`)
            }
            throw error
        }
    }

    shouldTerminateStream(chunk: string): boolean {
        return chunk === '[DONE]'
    }
}

// Anthropic Provider Adapter
class AnthropicAdapter implements ProviderAdapter {
    getEndpoint(host: string): string {
        return `${host}/v1/messages`
    }

    getHeaders(apiKey: string): Record<string, string> {
        return {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
    }

    buildRequestBody(messages: ChatCompletionRequestMessage[], model: string): any {
        // Anthropic requires separating system messages
        const systemMessages = messages.filter(m => m.role === 'system')
        const nonSystemMessages = messages.filter(m => m.role !== 'system')

        const body: any = {
            model: model,
            max_tokens: 4096,
            messages: nonSystemMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: true
        }

        // Add consolidated system message if any exist
        if (systemMessages.length > 0) {
            body.system = systemMessages.map(m => m.content).join('\n')
        }

        return body
    }

    parseStreamChunk(dataStr: string): string | null {
        try {
            const json = JSON.parse(dataStr)

            // Handle error events
            if (json.type === 'error') {
                throw new Error(`Error from Anthropic: ${json.error?.message || JSON.stringify(json)}`)
            }

            // Handle content_block_delta events with text
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                return json.delta.text
            }

            // Ignore other event types
            return null
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Error parsing JSON: ${dataStr}`)
            }
            throw error
        }
    }

    shouldTerminateStream(chunk: string): boolean {
        try {
            const json = JSON.parse(chunk)
            return json.type === 'message_stop'
        } catch {
            return false
        }
    }
}

// Factory function to get the appropriate adapter
function getProviderAdapter(provider: AIProvider): ProviderAdapter {
    switch (provider) {
        case AIProvider.OpenAI:
        case AIProvider.OpenAICompatible:
            return new OpenAIAdapter()
        case AIProvider.Anthropic:
            return new AnthropicAdapter()
        default:
            throw new Error(`Unsupported provider: ${provider}`)
    }
}

export async function replay(
    provider: AIProvider,
    apiKey: string,
    host: string,
    model: string,
    msgs: Message[],
    onText?: (text: string) => void,
    onError?: (error: Error) => void
) {
    if (msgs.length === 0) {
        throw new Error('No messages to replay')
    }
    const head = msgs[0]
    msgs = msgs.slice(1)


    const maxLen = 1800
    let totalLen = head.content.length

    let prompts: Message[] = []
    for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (msg.content.length + totalLen > maxLen) {
            break
        }
        prompts = [msg, ...prompts]
        totalLen += msg.content.length
    }
    prompts = [head, ...prompts]

    try {
        const adapter = getProviderAdapter(provider)
        const messages: ChatCompletionRequestMessage[] = prompts.map(msg => ({ role: msg.role, content: msg.content }))

        const endpoint = adapter.getEndpoint(host)
        const headers = adapter.getHeaders(apiKey)
        const body = adapter.buildRequestBody(messages, model)

        console.log(`[${provider}] Calling API:`, endpoint)
        console.log(`[${provider}] Model:`, model)

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        // Check for HTTP errors
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error.message || JSON.stringify(errorData.error);
                }
            } catch (e) {
                // If we can't parse the error response, use the status text
            }
            throw new Error(errorMessage);
        }

        if (!response.body) {
            throw new Error('No response body')
        }
        const reader = response.body.getReader();
        const d = new TextDecoder('utf8');
        let fullText = ''
        let partialData = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            } else {
                const raw = d.decode(value)
                if (partialData == '') {
                    partialData = raw
                } else {
                    partialData += raw;
                }
                const delimiterIndex = partialData.indexOf('\n\n');
                if (delimiterIndex === -1) {
                    continue;
                }
                let items = partialData.split('\n\n')
                partialData = ''
                items = items.map(item => item.replace(/^data: /, '')).filter(item => item.length > 0).filter(item => !adapter.shouldTerminateStream(item))

                for (const item of items) {
                    try {
                        const text = adapter.parseStreamChunk(item)
                        if (text !== undefined && text !== null) {
                            fullText += text
                            if (onText) {
                                onText(fullText)
                            }
                        }
                    } catch (error) {
                        throw new Error(`Error parsing item: ${item}.\nError Details: ${error}`)
                    }
                }
            }
        }
        return fullText
    } catch (error) {
        console.error(`[${provider}] API Error:`, error)
        let errorObj: Error

        if (error instanceof Error) {
            errorObj = error
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            errorObj = new Error(String(error.message))
        } else {
            errorObj = new Error(String(error))
        }

        // Add provider context to error message
        if (!errorObj.message.includes(provider)) {
            errorObj = new Error(`[${provider}] ${errorObj.message}`)
        }

        if (onError) {
            onError(errorObj)
        }
        throw errorObj
    }
}
