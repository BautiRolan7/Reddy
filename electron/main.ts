import { app, BrowserWindow, screen, ipcMain, shell, Tray, Menu, dialog } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { google } from 'googleapis'
import http from 'node:http'
import url from 'node:url'
import { spawnSync } from 'node:child_process'
import Store from 'electron-store'

const store = new Store()

// --- GOOGLE CONFIG ---
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email'
]

function getOAuthClient() {
  const clientId = store.get('googleClientId') as string
  const clientSecret = store.get('googleClientSecret') as string
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret, 'http://127.0.0.1:5005')
}

function getNextDayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

// --- AUTO-START (Windows Registry) ---
const AUTO_START_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const APP_NAME = 'Reddy'

function setAutoStart(enable: boolean): void {
  if (process.platform !== 'win32') return
  if (enable) {
    // For portable apps, process.execPath points to a temp folder.
    // process.env.PORTABLE_EXECUTABLE_FILE points to the actual .exe the user double-clicked.
    const actualExePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
    // Quote the path so Windows handles spaces in the user's directory (e.g. "Bautista Rolandi")
    const exePath = `"${actualExePath}"`
    spawnSync('reg', ['add', AUTO_START_KEY, '/v', APP_NAME, '/t', 'REG_SZ', '/d', exePath, '/f'])
  } else {
    spawnSync('reg', ['delete', AUTO_START_KEY, '/v', APP_NAME, '/f'], { stdio: 'ignore' })
  }
}

function isAutoStartEnabled(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const result = spawnSync('reg', ['query', AUTO_START_KEY, '/v', APP_NAME], { encoding: 'utf8' })
    return result.status === 0
  } catch {
    return false
  }
}
// ----------------------

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let dashboardWin: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const tasksFilePath = path.join(app.getPath('userData'), 'tasks.json')

// --- DASHBOARD WINDOW ---
function createDashboardWindow() {
  if (dashboardWin) {
    dashboardWin.focus()
    return
  }

  dashboardWin = new BrowserWindow({
    width: 500,
    height: 680,
    resizable: false,
    title: 'Reddy — Panel de control',
    frame: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  dashboardWin.setMenuBarVisibility(false)
  dashboardWin.on('closed', () => { dashboardWin = null })

  if (VITE_DEV_SERVER_URL) {
    dashboardWin.loadURL(VITE_DEV_SERVER_URL + '#dashboard')
  } else {
    dashboardWin.loadFile(path.join(process.env.DIST as string, 'index.html'), { hash: 'dashboard' })
  }
}

// --- TRAY ---
function createTray() {
  const trayIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../build/icon.ico')

  try {
    tray = new Tray(trayIconPath)
  } catch {
    // Fallback: create tray without icon if file not found
    return
  }

  tray.setToolTip('Reddy — Widget de tareas')

  const updateMenu = () => {
    const autoStartEnabled = isAutoStartEnabled()
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Mostrar widget', click: () => { if (win) win.show() } },
      { label: 'Panel de control', click: () => createDashboardWindow() },
      { type: 'separator' },
      {
        label: autoStartEnabled ? '✓ Inicio automático activo' : 'Inicio automático inactivo',
        enabled: false
      },
      { type: 'separator' },
      { label: 'Salir de Reddy', click: () => app.quit() }
    ])
    tray!.setContextMenu(contextMenu)
  }

  updateMenu()
  tray.on('double-click', () => createDashboardWindow())
}

// --- GENERAL IPC HANDLERS ---

ipcMain.removeHandler('get-tasks')
ipcMain.handle('get-tasks', () => {
  try {
    if (fs.existsSync(tasksFilePath)) {
      const data = fs.readFileSync(tasksFilePath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error reading tasks:', err)
  }
  return []
})

ipcMain.on('save-tasks', (_event, tasks) => {
  try {
    fs.writeFileSync(tasksFilePath, JSON.stringify(tasks, null, 2))
  } catch (err) {
    console.error('Error saving tasks:', err)
  }
})

ipcMain.removeHandler('get-current-position')
ipcMain.handle('get-current-position', () => {
  if (!win) return null
  return win.getBounds()
})

// --- AUTO-START IPC ---
ipcMain.removeHandler('get-autostart')
ipcMain.handle('get-autostart', () => isAutoStartEnabled())

ipcMain.removeHandler('set-autostart')
ipcMain.handle('set-autostart', (_event, enable: boolean) => {
  setAutoStart(enable)
  return { success: true, enabled: isAutoStartEnabled() }
})

// --- OPEN DASHBOARD IPC ---
ipcMain.removeHandler('open-dashboard')
ipcMain.handle('open-dashboard', () => {
  createDashboardWindow()
})

// --- HIDE WIDGET IPC ---
ipcMain.removeHandler('hide-widget')
ipcMain.handle('hide-widget', () => {
  if (win) win.hide()
})

// --- UNINSTALL IPC ---
ipcMain.removeHandler('uninstall-app')
ipcMain.handle('uninstall-app', async () => {
  const choice = await dialog.showMessageBox({
    type: 'warning',
    title: 'Desinstalar Reddy',
    message: '¿Desinstalar Reddy?',
    detail: 'Se eliminarán todos los datos locales y la configuración de inicio automático.\n\nDespués deberás borrar el archivo .exe manualmente.',
    buttons: ['Cancelar', 'Desinstalar'],
    defaultId: 0,
    cancelId: 0,
  })

  if (choice.response !== 1) return { cancelled: true }

  // Remove autostart
  setAutoStart(false)

  // Delete local data
  try {
    const userData = app.getPath('userData')
    const filesToDelete = ['tasks.json', 'config.json']
    for (const f of filesToDelete) {
      const fp = path.join(userData, f)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    }
    store.clear()
  } catch (e) {
    // best effort
  }

  app.quit()
  return { success: true }
})

// --- GOOGLE IPC HANDLERS ---

ipcMain.removeHandler('get-google-user')
ipcMain.handle('get-google-user', () => {
  const tokens = store.get('googleTokens')
  const email = store.get('googleEmail')
  if (tokens) return { loggedIn: true, email }
  return { loggedIn: false }
})

ipcMain.removeHandler('google-logout')
ipcMain.handle('google-logout', () => {
  store.delete('googleTokens')
  store.delete('googleEmail')
  store.delete('googleTaskListId')
})

ipcMain.removeHandler('save-google-credentials')
ipcMain.handle('save-google-credentials', (_event, { clientId, clientSecret }) => {
  store.set('googleClientId', clientId)
  store.set('googleClientSecret', clientSecret)
  return { success: true }
})

ipcMain.removeHandler('delete-google-task')
ipcMain.handle('delete-google-task', async (_event, payload: { googleTaskId: string; googleCalendarEventId?: string }) => {
  // Support both old string format and new object format
  const googleTaskId = typeof payload === 'string' ? payload : payload.googleTaskId
  const googleCalendarEventId = typeof payload === 'string' ? undefined : payload.googleCalendarEventId

  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()
  const taskListId = store.get('googleTaskListId') as string
  if (!tokens || !oauth2Client) return { success: false }

  try {
    oauth2Client.setCredentials(tokens)

    if (googleTaskId && taskListId) {
      const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client })
      await tasksApi.tasks.delete({ tasklist: taskListId, task: googleTaskId })
    }

    if (googleCalendarEventId) {
      try {
        const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })
        await calendarApi.events.delete({ calendarId: 'primary', eventId: googleCalendarEventId })
      } catch {
        // Calendar event may already be deleted
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
})

ipcMain.removeHandler('google-login')
ipcMain.handle('google-login', async () => {
  const oauth2Client = getOAuthClient()
  if (!oauth2Client) return { error: 'MISSING_CREDENTIALS' }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  })

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.indexOf('code=') !== -1) {
          const qs = new url.URL(req.url!, 'http://127.0.0.1:5005').searchParams
          const code = qs.get('code')
          res.end('<h1>Autenticacion exitosa!</h1><p>Ya puedes volver al widget.</p>')
          server.close()

          const { tokens } = await oauth2Client.getToken(code!)
          oauth2Client.setCredentials(tokens)

          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
          const userInfo = await oauth2.userinfo.get()
          store.set('googleTokens', tokens)
          store.set('googleEmail', userInfo.data.email)

          resolve({ success: true, email: userInfo.data.email })
        }
      } catch (e: any) {
        console.error('Auth Error Details:', e)
        resolve({ error: e.message || 'AUTH_FAILED' })
      }
    })

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') resolve({ error: 'PORT_IN_USE' })
    })

    server.listen(5005, () => { shell.openExternal(authUrl) })
  })
})

// FETCH DE TAREAS DESDE GOOGLE (para polling)
ipcMain.removeHandler('fetch-google-tasks')
ipcMain.handle('fetch-google-tasks', async () => {
  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()
  if (!tokens || !oauth2Client) return { error: 'NOT_LOGGED_IN' }

  try {
    oauth2Client.setCredentials(tokens)
    const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client })

    let taskListId = store.get('googleTaskListId') as string
    if (!taskListId) {
      const lists = await tasksApi.tasklists.list()
      const existing = (lists.data.items || []).find((l: any) => l.title === 'Widget TODO')
      if (existing) {
        taskListId = existing.id!
        store.set('googleTaskListId', taskListId)
      } else {
        return { success: true, tasks: [] }
      }
    }

    const remote = await tasksApi.tasks.list({
      tasklist: taskListId,
      showCompleted: true,
      showHidden: true
    })

    return { success: true, tasks: remote.data.items || [] }
  } catch (err: any) {
    return { error: err.message }
  }
})

// FETCH CALENDAR UPDATES (para polling bidireccional de fechas)
ipcMain.removeHandler('fetch-calendar-updates')
ipcMain.handle('fetch-calendar-updates', async (_event, taskEventIds: { taskId: string; googleCalendarEventId: string }[]) => {
  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()
  if (!tokens || !oauth2Client) return { error: 'NOT_LOGGED_IN' }
  if (!taskEventIds || taskEventIds.length === 0) return { success: true, updates: [] }

  try {
    oauth2Client.setCredentials(tokens)
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })
    const updates: { taskId: string; date: string }[] = []

    for (const item of taskEventIds) {
      try {
        const event = await calendarApi.events.get({
          calendarId: 'primary',
          eventId: item.googleCalendarEventId
        })
        const dateStr = event.data.start?.date
        if (dateStr) {
          const [y, m, d] = dateStr.split('-')
          updates.push({ taskId: item.taskId, date: `${d}/${m}/${y.slice(2)}` })
        }
      } catch {
        // Event deleted or inaccessible, skip
      }
    }

    return { success: true, updates }
  } catch (err: any) {
    return { error: err.message }
  }
})

// SINCRONIZACIÓN BIDIRECCIONAL (Tasks + Calendar)
ipcMain.removeHandler('sync-tasks')
ipcMain.handle('sync-tasks', async (_event, tasks) => {
  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()
  if (!tokens || !oauth2Client) return { error: 'NOT_LOGGED_IN' }

  oauth2Client.setCredentials(tokens)
  const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client })
  const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })

  try {
    let taskListId = store.get('googleTaskListId') as string
    if (!taskListId) {
      const res = await tasksApi.tasklists.insert({ requestBody: { title: 'Widget TODO' } })
      taskListId = res.data.id!
      store.set('googleTaskListId', taskListId)
    }

    const results = []

    for (const task of tasks) {
      let dueDate: string | undefined = undefined
      let calendarDateStr: string | undefined = undefined

      if (task.date) {
        const parts = task.date.split('/')
        if (parts.length === 3) {
          const year = 2000 + parseInt(parts[2])
          const month = parts[1].padStart(2, '0')
          const day = parts[0].padStart(2, '0')
          dueDate = `${year}-${month}-${day}T00:00:00Z`
          calendarDateStr = `${year}-${month}-${day}`
        }
      }

      const taskBody = {
        title: task.text,
        status: task.completed ? 'completed' : 'needsAction',
        due: dueDate
      }

      // 1. Sync to Google Tasks
      let taskResult = { ...task }

      if (task.googleTaskId) {
        try {
          await tasksApi.tasks.patch({ tasklist: taskListId, task: task.googleTaskId, requestBody: taskBody })
        } catch (e: any) {
          if (e.code === 404 || e.status === 404) {
            const res = await tasksApi.tasks.insert({ tasklist: taskListId, requestBody: taskBody })
            taskResult = { ...taskResult, googleTaskId: res.data.id }
          } else {
            console.error('Error patching task, skipping insert:', e.message)
          }
        }
      } else {
        const res = await tasksApi.tasks.insert({ tasklist: taskListId, requestBody: taskBody })
        taskResult = { ...taskResult, googleTaskId: res.data.id }
      }

      // 2. Sync to Google Calendar (all-day events)
      if (calendarDateStr && !task.completed) {
        const nextDay = getNextDayStr(calendarDateStr)
        const eventBody = {
          summary: task.text,
          start: { date: calendarDateStr },
          end: { date: nextDay }
        }

        try {
          if (taskResult.googleCalendarEventId) {
            await calendarApi.events.patch({
              calendarId: 'primary',
              eventId: taskResult.googleCalendarEventId,
              requestBody: eventBody
            })
          } else {
            const event = await calendarApi.events.insert({
              calendarId: 'primary',
              requestBody: eventBody
            })
            taskResult = { ...taskResult, googleCalendarEventId: event.data.id }
          }
        } catch (calErr: any) {
          if ((calErr.code === 404 || calErr.status === 404) && taskResult.googleCalendarEventId) {
            // Event deleted in Calendar, recreate
            try {
              const event = await calendarApi.events.insert({
                calendarId: 'primary',
                requestBody: eventBody
              })
              taskResult = { ...taskResult, googleCalendarEventId: event.data.id }
            } catch { /* ignore */ }
          }
          // For other calendar errors, continue without breaking Tasks sync
        }
      }

      results.push(taskResult)
    }

    // 3. Pull completion status back from Google Tasks
    const remote = await tasksApi.tasks.list({ tasklist: taskListId, showCompleted: true, showHidden: true })
    const remoteItems = remote.data.items || []

    const finalTasks = results.map((lt: any) => {
      const match = remoteItems.find((rt: any) => rt.id === lt.googleTaskId)
      if (match) return { ...lt, completed: match.status === 'completed' }
      return lt
    })

    return { success: true, tasks: finalTasks }
  } catch (err: any) {
    console.error('Sync Error:', err)
    return { error: err.message }
  }
})

// --- WINDOW LOGIC ---

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize

  win = new BrowserWindow({
    width: 420,
    height: 180,
    x: Math.floor((width - 420) / 2),
    y: 20,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (os.platform() === 'win32') {
    win.setAlwaysOnTop(false)
  }

  let isCurrentlyBottom = false
  const HYSTERESIS_THRESHOLD = 50

  win.on('move', () => {
    if (!win) return
    const bounds = win.getBounds()
    const primaryDisplay = screen.getPrimaryDisplay()
    const { height } = primaryDisplay.workAreaSize
    const midPoint = height / 2
    const widgetCoreCenterY = isCurrentlyBottom ? (bounds.y + bounds.height - 90) : (bounds.y + 90)

    let shouldBeBottom = isCurrentlyBottom
    if (isCurrentlyBottom) {
      if (widgetCoreCenterY < midPoint - HYSTERESIS_THRESHOLD) shouldBeBottom = false
    } else {
      if (widgetCoreCenterY > midPoint + HYSTERESIS_THRESHOLD) shouldBeBottom = true
    }

    if (shouldBeBottom !== isCurrentlyBottom) isCurrentlyBottom = shouldBeBottom

    win.webContents.send('window-moved', {
      y: bounds.y,
      isInBottomHalf: isCurrentlyBottom,
      screenHeight: height
    })
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST as string, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  // Don't quit when all windows are closed (tray keeps app alive)
  // Unless no tray is present
  if (!tray && process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.on('set-window-position', (_event, position) => {
  if (!win) return
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const winBounds = win.getBounds()
  const PADDING = 20
  let x = PADDING, y = PADDING

  switch (position) {
    case 'top-center': x = Math.floor((width - winBounds.width) / 2); break
    case 'top-right': x = width - winBounds.width - PADDING; break
    case 'bottom-left': y = height - winBounds.height - PADDING; break
    case 'bottom-center': x = Math.floor((width - winBounds.width) / 2); y = height - winBounds.height - PADDING; break
    case 'bottom-right': x = width - winBounds.width - PADDING; y = height - winBounds.height - PADDING; break
  }
  win.setPosition(x, y, true)
})

ipcMain.on('set-custom-position', (_event, bounds) => {
  if (!win) return
  win.setBounds(bounds)
})

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Auto-start: on first run, enable it by default
  const isFirstRun = !store.get('hasRunBefore')
  if (isFirstRun) {
    store.set('hasRunBefore', true)
    if (app.isPackaged) {
      setAutoStart(true)
    }
    // Show dashboard on first run so the user can see the auto-start status
    setTimeout(() => createDashboardWindow(), 800)
  } else {
    // If not first run, but autostart is enabled, re-apply it to ensure the path is correct
    // (e.g. if the user moved the portable .exe to a new location)
    if (app.isPackaged && isAutoStartEnabled()) {
      setAutoStart(true)
    }
  }
})
