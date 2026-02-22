const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Analysis functions
    startAnalysis: (config) => ipcRenderer.invoke('start-analysis', config),

    // Progress updates
    onAnalysisProgress: (callback) => {
        ipcRenderer.on('analysis-progress', (event, message) => callback(message));
    },

    removeAnalysisProgressListener: (callback) => {
        ipcRenderer.removeListener('analysis-progress', callback);
    },

    // File operations
    saveResults: (results, format) => ipcRenderer.invoke('save-results', { results, format }),

    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    showAbout: () => ipcRenderer.invoke('show-about')
});
