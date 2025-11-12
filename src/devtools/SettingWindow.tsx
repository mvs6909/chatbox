import React from 'react';
import './App.css';
import {
    Button, Alert,
    Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText, TextField,
    FormGroup, FormControlLabel, Switch, FormLabel, FormControl,
    Select, MenuItem, InputLabel, CircularProgress, Autocomplete,
} from '@mui/material';
import { Settings, AIProvider } from './types'
import { getDefaultSettings } from './store'
import ThemeChangeButton from './theme/ThemeChangeIcon';
import { ThemeMode } from './theme/index';
import { useThemeSwicher } from './theme/ThemeSwitcher';
import { fetchModels, clearModelCache } from './models';
import { getFallbackModelsForProvider, getDefaultHostForProvider } from './modelDefaults';

const { useEffect, useState } = React

interface Props {
    open: boolean
    settings: Settings
    close(): void
    save(settings: Settings): void
}

export default function SettingWindow(props: Props) {
    const [settingsEdit, setSettingsEdit] = React.useState<Settings>(props.settings);
    const [, { setMode }] = useThemeSwicher();
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);

    useEffect(() => {
        setSettingsEdit(props.settings)
    }, [props.settings])

    // Fetch models when provider, API key, or API host changes
    useEffect(() => {
        const loadModels = async () => {
            setModelsLoading(true);
            setModelsError(null);

            const result = await fetchModels(
                settingsEdit.provider,
                settingsEdit.apiHost,
                settingsEdit.apiKey,
                true // use cache
            );

            setAvailableModels(result.models);

            if (result.error) {
                setModelsError(result.error);
            }

            // If current model is not in the list, select the first one
            if (result.models.length > 0 && !result.models.includes(settingsEdit.selectedModel)) {
                setSettingsEdit({ ...settingsEdit, selectedModel: result.models[0] });
            }

            setModelsLoading(false);
        };

        if (settingsEdit.apiKey && settingsEdit.apiHost) {
            loadModels();
        } else {
            // No API key, just use fallback models
            const fallback = getFallbackModelsForProvider(settingsEdit.provider);
            setAvailableModels(fallback);
        }
    }, [settingsEdit.provider, settingsEdit.apiHost, settingsEdit.apiKey]);

    const handleProviderChange = (newProvider: AIProvider) => {
        clearModelCache(); // Clear cache when provider changes
        setSettingsEdit({
            ...settingsEdit,
            provider: newProvider,
            apiHost: getDefaultHostForProvider(newProvider),
            selectedModel: getFallbackModelsForProvider(newProvider)[0],
        });
    };

    const handleRefreshModels = async () => {
        clearModelCache();
        setModelsLoading(true);
        setModelsError(null);

        const result = await fetchModels(
            settingsEdit.provider,
            settingsEdit.apiHost,
            settingsEdit.apiKey,
            false // don't use cache
        );

        setAvailableModels(result.models);
        if (result.error) {
            setModelsError(result.error);
        }
        setModelsLoading(false);
    };

    const onCancel = () => {
        props.close()
        setSettingsEdit(props.settings)

        // need to restore the previous theme
        setMode(props.settings.theme || ThemeMode.System);
    }

    // preview theme
    const changeModeWithPreview = (newMode: ThemeMode) => {
        setSettingsEdit({ ...settingsEdit, theme: newMode });
        setMode(newMode);
    }

    return (
        <Dialog open={props.open} onClose={onCancel}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <DialogContentText>
                </DialogContentText>

                <FormControl fullWidth margin="dense">
                    <InputLabel>AI Provider</InputLabel>
                    <Select
                        value={settingsEdit.provider}
                        label="AI Provider"
                        onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    >
                        <MenuItem value={AIProvider.OpenAI}>OpenAI</MenuItem>
                        <MenuItem value={AIProvider.Anthropic}>Anthropic Claude</MenuItem>
                        <MenuItem value={AIProvider.OpenAICompatible}>OpenAI-Compatible</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    autoFocus
                    margin="dense"
                    label="API Key"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={settingsEdit.apiKey}
                    onChange={(e) => setSettingsEdit({ ...settingsEdit, apiKey: e.target.value.trim() })}
                />

                <TextField
                    margin="dense"
                    label="API Host"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={settingsEdit.apiHost}
                    onChange={(e) => setSettingsEdit({ ...settingsEdit, apiHost: e.target.value.trim() })}
                    helperText={settingsEdit.provider === AIProvider.OpenAICompatible ? "Custom API endpoint URL" : "Default endpoint for selected provider"}
                />

                <FormControl fullWidth margin="dense">
                    <Autocomplete
                        freeSolo
                        options={availableModels}
                        value={settingsEdit.selectedModel}
                        onChange={(event, newValue) => {
                            if (newValue) {
                                setSettingsEdit({ ...settingsEdit, selectedModel: newValue });
                            }
                        }}
                        onInputChange={(event, newInputValue) => {
                            if (newInputValue) {
                                setSettingsEdit({ ...settingsEdit, selectedModel: newInputValue });
                            }
                        }}
                        loading={modelsLoading}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Model"
                                helperText="Select from list or enter custom model name"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {modelsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />
                    {modelsError && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            {modelsError}
                            <Button size="small" onClick={handleRefreshModels}>Retry</Button>
                        </Alert>
                    )}
                </FormControl>

                {
                    settingsEdit.provider !== AIProvider.Anthropic &&
                    !settingsEdit.apiHost.match(/^(https?:\/\/)?api.openai.com(:\d+)?$/) && (
                        <Alert severity="warning">
                            Your API Key and all messages will be sent to <b>{settingsEdit.apiHost}</b>.
                            Please confirm that you trust this address. Otherwise, there is a risk of API Key and data leakage.
                            <Button onClick={() => setSettingsEdit({ ...settingsEdit, apiHost: getDefaultHostForProvider(settingsEdit.provider) })}>Reset</Button>
                        </Alert>
                    )
                }
                {
                    settingsEdit.provider === AIProvider.Anthropic &&
                    !settingsEdit.apiHost.match(/^(https?:\/\/)?api.anthropic.com(:\d+)?$/) && (
                        <Alert severity="warning">
                            Your API Key and all messages will be sent to <b>{settingsEdit.apiHost}</b>.
                            Please confirm that you trust this address. Otherwise, there is a risk of API Key and data leakage.
                            <Button onClick={() => setSettingsEdit({ ...settingsEdit, apiHost: getDefaultHostForProvider(settingsEdit.provider) })}>Reset</Button>
                        </Alert>
                    )
                }
                {
                    settingsEdit.apiHost.startsWith('http://') && (
                        <Alert severity="warning">
                            All data transfers are being conducted through the <b>HTTP</b> protocol, which may lead to the risk of API key and data leakage.
                            Unless you are completely certain and understand the potential risks involved, please consider using the HTTPS protocol instead.
                        </Alert>
                    )
                }
                {
                    !settingsEdit.apiHost.startsWith('http') && (
                        <Alert severity="error">
                            Please starts with https:// or http://
                        </Alert>
                    )
                }

                <FormGroup>
                    <FormControlLabel control={<Switch />} label="Show word count"
                        checked={settingsEdit.showWordCount}
                        onChange={(e, checked) => setSettingsEdit({ ...settingsEdit, showWordCount: checked })}
                    />
                </FormGroup>

                <FormGroup>
                    <FormControlLabel control={<Switch />} label="Show estimated token count"
                        checked={settingsEdit.showTokenCount}
                        onChange={(e, checked) => setSettingsEdit({ ...settingsEdit, showTokenCount: checked })}
                    />
                </FormGroup>

                <FormControl sx={{ flexDirection: 'row', alignItems: 'center', paddingTop: 1, paddingBottom: 1 }}>
                    <ThemeChangeButton value={settingsEdit.theme} onChange={theme => changeModeWithPreview(theme)} />
                    <span style={{ marginLeft: 10 }}>Theme</span>
                </FormControl>


            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={() => props.save(settingsEdit)}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
