import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Widget position
  setPosition: (position: string) => ipcRenderer.send('set-window-position', position),
  setCustomPosition: (bounds: any) => ipcRenderer.send('set-custom-position', bounds),
  getCurrentPosition: () => ipcRenderer.invoke('get-current-position'),

  // Tasks
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks: any) => ipcRenderer.send('save-tasks', tasks),

  // Window events
  onWindowMoved: (callback: (data: any) => void) => {
    ipcRenderer.on('window-moved', (_event, data) => callback(data))
  },

  // Google Tasks / Calendar Integration
  googleLogin: () => ipcRenderer.invoke('google-login'),
  googleLogout: () => ipcRenderer.invoke('google-logout'),
  getGoogleUser: () => ipcRenderer.invoke('get-google-user'),
  syncTasks: (tasks: any) => ipcRenderer.invoke('sync-tasks', tasks),
  fetchGoogleTasks: () => ipcRenderer.invoke('fetch-google-tasks'),
  fetchCalendarUpdates: (taskEventIds: { taskId: string; googleCalendarEventId: string }[]) =>
    ipcRenderer.invoke('fetch-calendar-updates', taskEventIds),
  saveGoogleCredentials: (creds: any) => ipcRenderer.invoke('save-google-credentials', creds),
  deleteGoogleTask: (payload: { googleTaskId: string; googleCalendarEventId?: string } | string) =>
    ipcRenderer.invoke('delete-google-task', payload),

  // Auto-start
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  setAutostart: (enable: boolean) => ipcRenderer.invoke('set-autostart', enable),

  // Dashboard
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  hideWidget: () => ipcRenderer.invoke('hide-widget'),
  uninstallApp: () => ipcRenderer.invoke('uninstall-app'),
})
