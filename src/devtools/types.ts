import {ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum} from './openai-node'
import { v4 as uuidv4 } from 'uuid';
import { ThemeMode } from './theme';

// AI Provider Types
export enum AIProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    OpenAICompatible = 'openai-compatible'
}

export type Message = ChatCompletionRequestMessage & {
    id: string
}

export interface Session{
    id: string
    name: string
    messages: Message[]
    model?: string          // Model used for this session
    provider?: AIProvider   // Provider used for this session
}

export function createMessage(role: ChatCompletionRequestMessageRoleEnum = ChatCompletionRequestMessageRoleEnum.User, content = ''): Message {
    return {
        id: uuidv4(),
        content: content,
        role: role,
    }
}

export function createSession(name = "Untitled"): Session {
    return {
        id: uuidv4(),
        name: name,
        messages: [],
    }
}

export interface Settings {
    apiKey: string              // Renamed from openaiKey for generic use
    apiHost: string
    provider: AIProvider        // Which provider to use
    selectedModel: string       // Currently selected model ID
    showWordCount?: boolean
    showTokenCount?: boolean
    theme: ThemeMode
}
