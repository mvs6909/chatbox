import {ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum} from './openai-node'
import { v4 as uuidv4 } from 'uuid';
import { ThemeMode } from './theme';

export type Message = ChatCompletionRequestMessage & {
    id: string
}

export interface Session{
    id: string
    name: string
    messages: Message[]
    draftMessage?: string
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
        draftMessage: '',
    }
}

export interface Settings {
    openaiKey: string
    apiHost: string
    showWordCount?: boolean
    showTokenCount?: boolean
    theme: ThemeMode
}
