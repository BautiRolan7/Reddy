import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  setPosition: (position: string) => ipcRenderer.send('set-window-position', position),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks: any) => ipcRenderer.send('save-tasks', tasks),
  getCurrentPosition: () => ipcRenderer.invoke('get-current-position'),
  deleteGoogleTask: (googleTaskId: string) => ipcRenderer.invoke('delete-google-task', googleTaskId),
  setCustomPosition: (bounds: any) => ipcRenderer.send('set-custom-position', bounds),
  onWindowMoved: (callback: (data: any) => void) => {
    ipcRenderer.on('window-moved', (_event, data) => callback(data))
  },
  // Google Tasks / Calendar Integration
  googleLogin: () => ipcRenderer.invoke('google-login'),
  googleLogout: () => ipcRenderer.invoke('google-logout'),
  getGoogleUser: () => ipcRenderer.invoke('get-google-user'),
  syncTasks: (tasks: any) => ipcRenderer.invoke('sync-tasks', tasks),
  fetchGoogleTasks: () => ipcRenderer.invoke('fetch-google-tasks'),
  saveGoogleCredentials: (creds: any) => ipcRenderer.invoke('save-google-credentials', creds)
})
