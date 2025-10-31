import { useState, useEffect } from 'react'
import { Settings, createSession, Session, Message } from './types'
import * as defaults from './defaults'
import * as openai from './openai-node'
import { v4 as uuidv4 } from 'uuid';
import { ThemeMode } from './theme';

// ipc

export const writeStore = (key: string, value: any) => {
    return (window as any).api.invoke('setStoreValue', key, value)
}
export const readStore = (key: string) => {
    return (window as any).api.invoke('getStoreValue', key)
}
export const getVersion = () => {
    return (window as any).api.invoke('getVersion')
}
export const openLink = (link: string) => {
    return (window as any).api.invoke('openLink', link)
}

export const shouldUseDarkColors = (): Promise<boolean> => {
    return api.invoke('shouldUseDarkColors');
};

// setting store

export function getDefaultSettings(): Settings {
    return {
        openaiKey: '',
        apiHost: 'https://api.openai.com',
        showWordCount: false,
        showTokenCount: false,
        theme: ThemeMode.System,
    }
}

export async function readSettings(): Promise<Settings> {
    const setting = await readStore('settings')
    if (!setting) {
        return getDefaultSettings()
    }
    // 兼容早期版本
    if (!setting.apiHost) {
        setting.apiHost = getDefaultSettings().apiHost
    }
    if (setting.showWordCount === undefined) {
        setting.showWordCount = getDefaultSettings().showWordCount
    }
    if (setting.showTokenCount === undefined) {
        setting.showTokenCount = getDefaultSettings().showTokenCount
    }
    if (setting.theme === undefined) {
        setting.theme = getDefaultSettings().theme;
    }
    return setting
}

export async function writeSettings(settings: Settings) {
    if (!settings.apiHost) {
        settings.apiHost = getDefaultSettings().apiHost
    }
    console.log('writeSettings.apiHost', settings.apiHost)
    openai.setHost(settings.apiHost)
    return writeStore('settings', settings)
}

// session store

export async function readSessions(): Promise<Session[]> {
    let sessions = await readStore('chat-sessions')
    if (!sessions) {
        return defaults.sessions
    }
    if (sessions.length === 0) {
        return [createSession()]
    }
    return sessions
}

export async function writeSessions(sessions: Session[]) {
    return writeStore('chat-sessions', sessions)
}

// Export/Import functionality

export interface ExportData {
    version: string;
    exportDate: string;
    session: Session;
}

export async function exportSession(session: Session): Promise<{ success: boolean; error?: string }> {
    const exportData: ExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        session: session,
    };

    // Create a safe filename from the session name
    const safeFileName = session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    const options = {
        title: 'Export Chat Session',
        defaultPath: `${safeFileName}-${dateStr}.json`,
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    };

    const result = await (window as any).api.invoke('showSaveDialog', options);

    if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
    }

    const writeResult = await (window as any).api.invoke('writeFile', result.filePath, JSON.stringify(exportData, null, 2));

    if (!writeResult.success) {
        return { success: false, error: writeResult.error };
    }

    return { success: true };
}

export function validateImportData(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON format' };
    }

    if (!data.session || typeof data.session !== 'object') {
        return { valid: false, error: 'Missing or invalid session object' };
    }

    const session = data.session;

    if (!session.id || typeof session.id !== 'string') {
        return { valid: false, error: 'Session: Missing or invalid \'id\' field' };
    }

    if (!session.name || typeof session.name !== 'string') {
        return { valid: false, error: 'Session: Missing or invalid \'name\' field' };
    }

    if (!session.messages || !Array.isArray(session.messages)) {
        return { valid: false, error: 'Session: Missing or invalid \'messages\' array' };
    }

    for (let j = 0; j < session.messages.length; j++) {
        const message = session.messages[j];

        if (!message.id || typeof message.id !== 'string') {
            return { valid: false, error: `Message ${j + 1}: Missing or invalid 'id' field` };
        }

        if (!message.role || typeof message.role !== 'string') {
            return { valid: false, error: `Message ${j + 1}: Missing or invalid 'role' field` };
        }

        if (message.content === undefined || typeof message.content !== 'string') {
            return { valid: false, error: `Message ${j + 1}: Missing or invalid 'content' field` };
        }
    }

    return { valid: true };
}

export async function importSession(existingSessions: Session[]): Promise<{ success: boolean; session?: Session; error?: string }> {
    const options = {
        title: 'Import Chat Session',
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
    };

    const result = await (window as any).api.invoke('showOpenDialog', options);

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, error: 'Import cancelled' };
    }

    try {
        const readResult = await (window as any).api.invoke('readFile', result.filePaths[0]);

        if (!readResult.success) {
            return { success: false, error: readResult.error };
        }

        const importData = JSON.parse(readResult.content);

        const validation = validateImportData(importData);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Handle duplicate IDs by generating new ones
        const existingIds = new Set(existingSessions.map(s => s.id));
        let importedSession = importData.session;

        if (existingIds.has(importedSession.id)) {
            // Generate a new ID for duplicate session
            importedSession = {
                ...importedSession,
                id: uuidv4(),
                name: `${importedSession.name} (imported)`,
            };
        }

        return { success: true, session: importedSession };
    } catch (error) {
        if (error instanceof SyntaxError) {
            return { success: false, error: 'Invalid JSON file format' };
        }
        return { success: false, error: `Import failed: ${error.message}` };
    }
}

// react hook

export default function useStore() {
    const [version, _setVersion] = useState('unknown')
    useEffect(() => {
        getVersion().then((version: any) => {
            _setVersion(version)
        })
    }, [])

    const [settings, _setSettings] = useState<Settings>(getDefaultSettings())
    const [needSetting, setNeedSetting] = useState(false)
    useEffect(() => {
        readSettings().then((settings) => {
            _setSettings(settings)
            if (settings.openaiKey === '') {
                setNeedSetting(true)
            }
        })
    }, [])
    const setSettings = (settings: Settings) => {
        _setSettings(settings)
        writeSettings(settings)
    }

    const [chatSessions, _setChatSessions] = useState<Session[]>([createSession()])
    const [currentSession, switchCurrentSession] = useState<Session>(chatSessions[0])
    useEffect(() => {
        readSessions().then((sessions: Session[]) => {
            _setChatSessions(sessions)
            switchCurrentSession(sessions[0])
        })
    }, [])
    const setSessions = (sessions: Session[]) => {
        _setChatSessions(sessions)
        writeSessions(sessions)
    }

    const deleteChatSession = (target: Session) => {
        const sessions = chatSessions.filter((s) => s.id !== target.id)
        if (sessions.length === 0) {
            sessions.push(createSession())
        }
        if (target.id === currentSession.id) {
            switchCurrentSession(sessions[0])
        }
        setSessions(sessions)
    }
    const updateChatSession = (session: Session) => {
        const sessions = chatSessions.map((s) => {
            if (s.id === session.id) {
                return session
            }
            return s
        })
        setSessions(sessions)
        if (session.id === currentSession.id) {
            switchCurrentSession(session)
        }
    }
    const createChatSession = (session: Session, ix?: number) => {
        const sessions = [...chatSessions, session]
        setSessions(sessions)
        switchCurrentSession(session)
    }
    const createEmptyChatSession = () => {
        createChatSession(createSession())
    }

    const setMessages = (session: Session, messages: Message[]) => {
        updateChatSession({
            ...session,
            messages,
        })
    }

    const [toasts, _setToasts] = useState<{id: string, content: string}[]>([])
    const addToast = (content: string) => {
        const id = uuidv4()
        _setToasts([...toasts, {id, content}])
    }
    const removeToast = (id: string) => {
        _setToasts(toasts.filter((t) => t.id !== id))
    }

    const handleExportSession = async (session: Session) => {
        const result = await exportSession(session);
        if (result.success) {
            addToast('Session exported successfully!');
        } else if (result.error && result.error !== 'Export cancelled') {
            addToast(`Export failed: ${result.error}`);
        }
    };

    const handleImportSession = async () => {
        const result = await importSession(chatSessions);
        if (result.success && result.session) {
            createChatSession(result.session);
            addToast('Session imported successfully!');
        } else if (result.error && result.error !== 'Import cancelled') {
            addToast(`Import failed: ${result.error}`);
        }
    };

    return {
        version,

        settings,
        setSettings,
        needSetting,

        chatSessions,
        createChatSession,
        updateChatSession,
        deleteChatSession,
        createEmptyChatSession,

        currentSession,
        switchCurrentSession,

        toasts,
        addToast,
        removeToast,

        handleExportSession,
        handleImportSession,
    }
}