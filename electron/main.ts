import { app, BrowserWindow, screen, ipcMain, shell } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { google } from 'googleapis'
import http from 'node:http'
import url from 'node:url'
import Store from 'electron-store'

const store = new Store()

// --- GOOGLE CONFIG ---
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.email'
]

function getOAuthClient() {
  const clientId = store.get('googleClientId') as string
  const clientSecret = store.get('googleClientSecret') as string
  if (!clientId || !clientSecret) return null

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://127.0.0.1:5005'
  )
}
// ----------------------

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const tasksFilePath = path.join(app.getPath('userData'), 'tasks.json')

// --- GENERAL IPC HANDLERS ---

ipcMain.removeHandler('get-tasks');
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

ipcMain.removeHandler('get-current-position');
ipcMain.handle('get-current-position', () => {
  if (!win) return null
  return win.getBounds()
})

// --- GOOGLE IPC HANDLERS (REPARADOS Y AMPLIADOS) ---

ipcMain.removeHandler('get-google-user');
ipcMain.handle('get-google-user', () => {
  const tokens = store.get('googleTokens')
  const email = store.get('googleEmail')
  if (tokens) {
    return { loggedIn: true, email }
  }
  return { loggedIn: false }
})

ipcMain.removeHandler('google-logout');
ipcMain.handle('google-logout', () => {
  store.delete('googleTokens')
  store.delete('googleEmail')
  store.delete('googleTaskListId')
})

ipcMain.removeHandler('save-google-credentials');
ipcMain.handle('save-google-credentials', (_event, { clientId, clientSecret }) => {
  store.set('googleClientId', clientId)
  store.set('googleClientSecret', clientSecret)
  return { success: true }
})

// NUEVO: Handler para borrar en Google cuando borras en el widget
ipcMain.removeHandler('delete-google-task');
ipcMain.handle('delete-google-task', async (_event, googleTaskId) => {
  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()
  const taskListId = store.get('googleTaskListId') as string
  if (!tokens || !oauth2Client || !googleTaskId || !taskListId) return { success: false }

  try {
    oauth2Client.setCredentials(tokens)
    const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client })
    await tasksApi.tasks.delete({ tasklist: taskListId, task: googleTaskId })
    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
})

ipcMain.removeHandler('google-login');
ipcMain.handle('google-login', async () => {
  const oauth2Client = getOAuthClient()
  if (!oauth2Client) {
    return { error: 'MISSING_CREDENTIALS' }
  }

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
      if (e.code === 'EADDRINUSE') {
        resolve({ error: 'PORT_IN_USE' })
      }
    })

    server.listen(5005, () => {
      shell.openExternal(authUrl)
    })
  })
})

// FETCH DE TAREAS DESDE GOOGLE (para polling)
ipcMain.removeHandler('fetch-google-tasks');
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

// SINCRONIZACIÓN MEJORADA (BIDIRECCIONAL)
ipcMain.removeHandler('sync-tasks');
ipcMain.handle('sync-tasks', async (_event, tasks) => {
  const tokens = store.get('googleTokens') as any
  const oauth2Client = getOAuthClient()

  if (!tokens || !oauth2Client) return { error: 'NOT_LOGGED_IN' }

  oauth2Client.setCredentials(tokens)
  const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client })

  try {
    let taskListId = store.get('googleTaskListId') as string
    if (!taskListId) {
      const res = await tasksApi.tasklists.insert({
        requestBody: { title: 'Widget TODO' }
      })
      taskListId = res.data.id!
      store.set('googleTaskListId', taskListId)
    }

    const results = []
    // 1. Enviamos cambios de Local a Google
    for (const task of tasks) {
      let dueDate: string | undefined = undefined
      if (task.date) {
        const parts = task.date.split('/')
        if (parts.length === 3) {
          const year = 2000 + parseInt(parts[2])
          const month = parts[1]
          const day = parts[0]
          dueDate = `${year}-${month}-${day}T00:00:00Z`
        }
      }

      const taskBody = {
        title: task.text,
        status: task.completed ? 'completed' : 'needsAction',
        due: dueDate
      }

      if (task.googleTaskId) {
        try {
          await tasksApi.tasks.patch({
            tasklist: taskListId,
            task: task.googleTaskId,
            requestBody: taskBody
          })
          results.push({ ...task })
        } catch (e: any) {
          if (e.code === 404 || e.status === 404) {
            // La tarea fue eliminada en Google → la recreamos
            const res = await tasksApi.tasks.insert({
              tasklist: taskListId,
              requestBody: taskBody
            })
            results.push({ ...task, googleTaskId: res.data.id })
          } else {
            // Otro error (auth, red, etc.) → no duplicar, conservar tarea local
            console.error('Error patching task, skipping insert:', e.message)
            results.push({ ...task })
          }
        }
      } else {
        const res = await tasksApi.tasks.insert({
          tasklist: taskListId,
          requestBody: taskBody
        })
        results.push({ ...task, googleTaskId: res.data.id })
      }
    }

    // 2. Traemos cambios de Google a Local (Actualiza si se completó afuera)
    const remote = await tasksApi.tasks.list({
      tasklist: taskListId,
      showCompleted: true,
      showHidden: true
    })
    const remoteItems = remote.data.items || []

    const finalTasks = results.map((lt: any) => {
      const match = remoteItems.find((rt: any) => rt.id === lt.googleTaskId)
      if (match) {
        return { ...lt, completed: match.status === 'completed' }
      }
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
      if (widgetCoreCenterY < midPoint - HYSTERESIS_THRESHOLD) {
        shouldBeBottom = false
      }
    } else {
      if (widgetCoreCenterY > midPoint + HYSTERESIS_THRESHOLD) {
        shouldBeBottom = true
      }
    }

    if (shouldBeBottom !== isCurrentlyBottom) {
      isCurrentlyBottom = shouldBeBottom
    }

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
  if (process.platform !== 'darwin') app.quit()
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

app.whenReady().then(createWindow)