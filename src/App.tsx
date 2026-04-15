import React, { useState, useEffect, useRef } from 'react'
import { Plus, Settings, ChevronDown, Check, Trash2, Calendar, CalendarCheck, LayoutPanelLeft, ChevronLeft, ChevronRight, Palette, Clock, AlertTriangle, GripVertical } from 'lucide-react'

declare global {
  interface Window {
    electronAPI?: {
      setPosition: (pos: string) => void
      getTasks: () => Promise<Task[]>
      saveTasks: (tasks: Task[]) => void
      getCurrentPosition: () => Promise<any>
      setCustomPosition: (bounds: any) => void
      onWindowMoved: (callback: (data: any) => void) => void
      googleLogin: () => Promise<any>
      googleLogout: () => Promise<void>
      getGoogleUser: () => Promise<any>
      syncTasks: (tasks: Task[]) => Promise<any>
      fetchGoogleTasks: () => Promise<any>
      saveGoogleCredentials: (creds: { clientId: string, clientSecret: string }) => Promise<any>
      deleteGoogleTask: (googleTaskId: string) => Promise<{ success: boolean }>
    }
  }
}

type Task = {
  id: string
  text: string
  date: string
  completed: boolean
  googleTaskId?: string
}

const GoogleCalendarLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(3.75 3.75)">
      <path fill="#FFFFFF" d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579 l5.263-53.947L148.882,43.618z" />
      <path fill="#1A73E8" d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342 c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026 s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487 c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276 l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145 c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184 c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211 s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421 C73.408,129.263,69.145,127.934,65.211,125.276z" />
      <path fill="#1A73E8" d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895L121.25,79.961z" />
      <path fill="#EA4335" d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684L148.882,196.25z" />
      <path fill="#34A853" d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618L33.092,172.566z" />
      <path fill="#4285F4" d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263 l10.526-23.684L148.882-3.75H12.039z" />
      <path fill="#188038" d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368H-3.75z" />
      <path fill="#FBBC04" d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526L148.882,43.618z" />
      <path fill="#1967D2" d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368H196.25z" />
    </g>
  </svg>
)

const getContrastYIQ = (hexcolor: string) => {
  let color = hexcolor.replace('#', '')
  if (color.length === 3) color = color.split('').map(c => c + c).join('')
  let num = parseInt(color, 16)
  if (isNaN(num)) return 'white'
  let r = (num >> 16) & 0xFF
  let g = (num >> 8) & 0xFF
  let b = num & 0xFF
  let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return (yiq >= 140) ? '#1f2937' : 'white'
}

const darkenHex = (hex: string, amount: number) => {
  let color = hex.replace('#', '')
  if (color.length === 3) color = color.split('').map(c => c + c).join('')
  let num = parseInt(color, 16)
  if (isNaN(num)) return hex
  let r = (num >> 16) & 0xFF
  let g = (num >> 8) & 0xFF
  let b = num & 0xFF
  const factor = 1 - (amount / 100)
  r = Math.floor(r * factor)
  g = Math.floor(g * factor)
  b = Math.floor(b * factor)
  return '#' + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0')
}

function App() {
  const [expanded, setExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [tasks, setTasks] = useState<Task[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [themeColor, setThemeColor] = useState(localStorage.getItem('themeColor') || '#111827')
  const [daysWarning, setDaysWarning] = useState(parseInt(localStorage.getItem('daysWarning') || '5'))
  const [daysUrgent, setDaysUrgent] = useState(parseInt(localStorage.getItem('daysUrgent') || '2'))
  const [widgetPosition, setWidgetPosition] = useState(localStorage.getItem('widgetPos') || 'top-center')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [isAddingPosition, setIsAddingPosition] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showGoogleCredentials, setShowGoogleCredentials] = useState(false)
  const [tempClientId, setTempClientId] = useState('')
  const [tempClientSecret, setTempClientSecret] = useState('')

  // Refs para polling (evitar closures desactualizados)
  const tasksRef = useRef<Task[]>(tasks)
  const isGoogleConnectedRef = useRef(isGoogleConnected)
  const newCalendarBtnRef = useRef<HTMLButtonElement>(null)
  const [newCalendarPos, setNewCalendarPos] = useState({ x: 0, y: 0 })

  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { isGoogleConnectedRef.current = isGoogleConnected }, [isGoogleConnected])

  // Dragging state for the handle
  const draggingRef = useRef<{
    offsetX: number;
    offsetMouseY: number;
    width: number;
    height: number;
    initialGripY: number;
  } | null>(null)
  const gripRef = useRef<HTMLDivElement>(null)

  const handleDragStart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.electronAPI?.getCurrentPosition || !gripRef.current) return

    const pos = await window.electronAPI.getCurrentPosition()
    if (!pos) return

    setIsDragging(true)

    // Calculate mouse offset relative to the grip's screen position
    const gripRect = gripRef.current.getBoundingClientRect()

    draggingRef.current = {
      offsetX: e.clientX,
      offsetMouseY: e.clientY - (gripRect.top + gripRect.height / 2),
      width: pos.width,
      height: pos.height,
      initialGripY: gripRect.top + gripRect.height / 2
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current) return

      // Use stored offset for X to prevent jumps
      const targetX = Math.round(event.screenX - draggingRef.current.offsetX)
      // Use dynamic Y calculation for stability across modes
      const targetY = Math.round(event.screenY - (draggingRef.current.initialGripY + draggingRef.current.offsetMouseY))

      window.electronAPI!.setCustomPosition({
        x: targetX,
        y: targetY,
        width: draggingRef.current.width,
        height: draggingRef.current.height
      })
    }

    const handleMouseUp = () => {
      draggingRef.current = null
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
  const [calendarPos, setCalendarPos] = useState({ x: 0, y: 0 })
  const [isReversed, setIsReversed] = useState(false)

  const [draftThemeColor, setDraftThemeColor] = useState(themeColor)
  const [draftDaysWarning, setDraftDaysWarning] = useState(String(daysWarning))
  const [draftDaysUrgent, setDraftDaysUrgent] = useState(String(daysUrgent))

  useEffect(() => {
    localStorage.setItem('themeColor', themeColor)
    localStorage.setItem('daysWarning', daysWarning.toString())
    localStorage.setItem('daysUrgent', daysUrgent.toString())
  }, [themeColor, daysWarning, daysUrgent])

  const openSettings = () => {
    setDraftThemeColor(themeColor)
    setDraftDaysWarning(String(daysWarning))
    setDraftDaysUrgent(String(daysUrgent))
    setShowSettings(true)
    if (!expanded) setExpanded(true)
  }

  const saveSettings = () => {
    setThemeColor(draftThemeColor)
    setDaysWarning(draftDaysWarning === '' ? 0 : parseInt(draftDaysWarning))
    setDaysUrgent(draftDaysUrgent === '' ? 0 : parseInt(draftDaysUrgent))
  }

  const handleGoogleLogin = async () => {
    if (window.electronAPI) {
      const res = await window.electronAPI.googleLogin()
      if (res.success) {
        setIsGoogleConnected(true)
        setUserEmail(res.email)
        syncTasksToGoogle(tasks)
      } else if (res.error === 'MISSING_CREDENTIALS') {
        setShowGoogleCredentials(true)
      } else if (res.error === 'PORT_IN_USE') {
        alert('El puerto 5005 está ocupado. Cierra otros programas e intenta de nuevo.')
      } else {
        alert('Error al vincular cuenta: ' + (res.error || 'Desconocido'))
      }
    }
  }

  const handleGoogleLogout = async () => {
    if (window.electronAPI) {
      await window.electronAPI.googleLogout()
      setIsGoogleConnected(false)
      setUserEmail(null)
    }
  }

  const syncTasksToGoogle = async (currentTasks: Task[]) => {
    if (!isGoogleConnected || !window.electronAPI) return
    setIsSyncing(true)
    const res = await window.electronAPI.syncTasks(currentTasks)
    if (res.success) {
      updateTasks(res.tasks)
    }
    setIsSyncing(false)
  }

  const saveCredentials = () => {
    if (window.electronAPI) {
      window.electronAPI.saveGoogleCredentials({ clientId: tempClientId, clientSecret: tempClientSecret }).then(() => {
        setShowGoogleCredentials(false)
        handleGoogleLogin()
      })
    }
  }

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getTasks().then(loadedTasks => {
        if (loadedTasks && loadedTasks.length > 0) {
          setTasks(loadedTasks)
        } else {
          setTasks([])
        }
      })

      if (window.electronAPI.onWindowMoved) {
        window.electronAPI.onWindowMoved((data) => {
          setIsReversed(prev => {
            if (prev !== data.isInBottomHalf) {
              // Mode changed!
              return data.isInBottomHalf
            }
            return prev
          })
        })
      }
    }
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getGoogleUser().then((user: any) => {
        setIsGoogleConnected(user.loggedIn)
        if (user.loggedIn) setUserEmail(user.email)
      })
    }
  }, [])

  // Compensate for Grip jump during drag when mode changes
  useEffect(() => {
    if (isDragging && draggingRef.current && gripRef.current) {
      const gripRect = gripRef.current.getBoundingClientRect()
      const newGripY = gripRect.top + gripRect.height / 2

      // Update the anchor to the new grip position to prevent jump in next move
      // We don't move the window here, handleMouseMove will take care of it in the next frame
      // by using this new initialGripY. This will result in the window moving by the diff.
      draggingRef.current.initialGripY = newGripY
    }
  }, [isReversed])

  // Dynamic window resizing when expanded state or orientation changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const adjustWindow = async () => {
      if (!window.electronAPI) return

      const pos = await window.electronAPI.getCurrentPosition()
      if (!pos) return

      const targetHeight = expanded ? 640 : 180
      if (targetHeight === pos.height) return

      const setPos = (y: number, h: number) => {
        window.electronAPI!.setCustomPosition({
          x: pos.x,
          y: Math.round(y),
          width: 420,
          height: Math.round(h)
        })
      }

      if (expanded) {
        if (isReversed) {
          // BOTTOM MODE EXPANSION:
          // Step 1: Grow window DOWNWARDS first (keep Y same).
          // Since it's justify-end, the widget stays at the same screen Y (pos.y + 180).
          setPos(pos.y, 640)

          // Step 2: Move window UP in the next possible frame to its final target position.
          // Because the height is already 640, the bottom-aligned widget stays at the same screen Y.
          requestAnimationFrame(() => {
            setPos(pos.y - 460, 640)
          })
        } else {
          // TOP MODE EXPANSION: Simple downward growth, widget at top is static.
          setPos(pos.y, 640)
        }
      } else {
        // CONTRACTION:
        // Wait for CSS animation to finish before snapping window back
        timeoutId = setTimeout(async () => {
          const freshPos = await window.electronAPI!.getCurrentPosition()
          if (!freshPos) return

          if (isReversed) {
            // BOTTOM MODE CONTRACTION:
            // Step 1: Move window DOWN first (keep Bottom static).
            // Height is still 640, so widget at bottom is static.
            setPos(freshPos.y + 460, 640)

            // Step 2: Shrink height.
            requestAnimationFrame(() => {
              setPos(freshPos.y + 460, 180)
            })
          } else {
            // TOP MODE CONTRACTION: Simple upward shrink.
            setPos(freshPos.y, 180)
          }
        }, 300)
      }
    }

    adjustWindow()
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [expanded, isReversed])

  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks)
    if (window.electronAPI) {
      window.electronAPI.saveTasks(newTasks)
    }
  }

  const syncAfterUpdate = (newTasks: Task[]) => {
    updateTasks(newTasks)
    if (isGoogleConnected) {
      syncTasksToGoogle(newTasks)
    }
  }

  const mergeWithGoogleTasks = (localTasks: Task[], remoteItems: any[]): Task[] => {
    const merged: Task[] = []

    // Actualizar tareas locales que existen en Google
    for (const local of localTasks) {
      if (local.googleTaskId) {
        const remote = remoteItems.find((r: any) => r.id === local.googleTaskId)
        if (!remote) continue // Fue eliminada en Google → no la incluimos
        let date = local.date
        if (remote.due) {
          const d = new Date(remote.due)
          date = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`
        }
        merged.push({
          ...local,
          text: remote.title || local.text,
          date,
          completed: remote.status === 'completed'
        })
      } else {
        // Tarea local sin ID de Google (aún no sincronizada)
        merged.push(local)
      }
    }

    // Agregar tareas nuevas que están en Google pero no en local
    for (const remote of remoteItems) {
      if (!remote.title) continue
      const exists = localTasks.some((lt: Task) => lt.googleTaskId === remote.id)
      if (!exists) {
        let date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
        if (remote.due) {
          const d = new Date(remote.due)
          date = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`
        }
        merged.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          text: remote.title,
          date,
          completed: remote.status === 'completed',
          googleTaskId: remote.id
        })
      }
    }

    return merged
  }

  // Polling: sincroniza Google → Widget cada 30 segundos
  useEffect(() => {
    if (!isGoogleConnected) return

    const poll = async () => {
      if (!isGoogleConnectedRef.current || !window.electronAPI?.fetchGoogleTasks) return
      const res = await window.electronAPI.fetchGoogleTasks()
      if (!res.success) return

      const merged = mergeWithGoogleTasks(tasksRef.current, res.tasks)

      // Solo actualizar si hubo cambios reales
      if (JSON.stringify(merged) !== JSON.stringify(tasksRef.current)) {
        updateTasks(merged)
      }
    }

    poll() // Sync inmediato al conectar
    const intervalId = setInterval(poll, 30000)
    return () => clearInterval(intervalId)
  }, [isGoogleConnected])

  const updateTaskDate = (id: string, newDate: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === id) {
        const [y, m, d] = newDate.split('-')
        const dd = d.padStart(2, '0')
        const mm = m.padStart(2, '0')
        const yy = y.slice(2)
        return { ...t, date: `${dd}/${mm}/${yy}` }
      }
      return t
    })
    syncAfterUpdate(updatedTasks)
  }

  const updateTaskText = (id: string, newText: string) => {
    setEditingTextId(null)
    if (!newText.trim() || tasks.find(t => t.id === id)?.text === newText) {
      return
    }
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, text: newText } : t)
    syncAfterUpdate(updatedTasks)
  }

  const toggleTask = (id: string) => {
    syncAfterUpdate(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task?.googleTaskId && isGoogleConnected && window.electronAPI?.deleteGoogleTask) {
      await window.electronAPI.deleteGoogleTask(task.googleTaskId)
    }
    updateTasks(tasks.filter(t => t.id !== id))
  }

  const addTask = () => {
    if (!newTaskText.trim()) return

    let formattedDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
    if (selectedDate) {
      const parts = selectedDate.split('-')
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
      }
    }

    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      date: formattedDate,
      completed: false
    }

    syncAfterUpdate([newTask, ...tasks])
    setNewTaskText('')
    setSelectedDate('')
    setExpanded(true)
    setShowSettings(false)
  }

  const changePosition = (pos: string) => {
    setWidgetPosition(pos)
    localStorage.setItem('widgetPos', pos)
    if (window.electronAPI) {
      window.electronAPI.setPosition(pos)
    }
  }

  const saveCustomPosition = async () => {
    if (window.electronAPI && window.electronAPI.getCurrentPosition) {
      const bounds = await window.electronAPI.getCurrentPosition()
      if (bounds) {
        localStorage.setItem('customBounds', JSON.stringify(bounds))
        setWidgetPosition('custom')
        localStorage.setItem('widgetPos', 'custom')
        setIsAddingPosition(false)
      }
    }
  }

  const restoreCustomPosition = () => {
    const saved = localStorage.getItem('customBounds')
    if (saved && window.electronAPI && window.electronAPI.setCustomPosition) {
      const bounds = JSON.parse(saved)
      window.electronAPI.setCustomPosition(bounds)
      setWidgetPosition('custom')
      localStorage.setItem('widgetPos', 'custom')
    }
  }

  const pendingCount = tasks.filter(t => !t.completed).length
  const totalCount = tasks.length

  useEffect(() => {
    const handleGlobalTrigger = (e: MouseEvent) => {
      if (editingTextId && !(e.target as HTMLElement).closest('input')) {
        updateTaskText(editingTextId, editingValue)
      }
    }

    const handleWindowBlur = () => {
      if (editingTextId) {
        updateTaskText(editingTextId, editingValue)
      }
    }

    window.addEventListener('mousedown', handleGlobalTrigger)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('mousedown', handleGlobalTrigger)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [editingTextId, editingValue])

  const activeColor = showSettings ? draftThemeColor : themeColor

  let statusText = ''
  if (totalCount === 0) {
    statusText = 'Ninguna tarea registrada'
  } else if (pendingCount === 0) {
    statusText = 'Ninguna tarea pendiente'
  } else {
    statusText = `${pendingCount} tarea${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`
  }

  return (
    <div className={`mx-auto w-[420px] select-none font-sans overflow-visible flex flex-col items-center ${isReversed ? 'justify-end pb-6' : 'justify-start pt-6'} h-full ${isDragging ? 'dragging' : ''}`}>


      <style>{`
        :root {
          --theme-bg: ${activeColor};
          --theme-hover: ${darkenHex(activeColor, 30)};
          --theme-shadow: ${darkenHex(activeColor, 20)};
          --theme-text: ${getContrastYIQ(activeColor)};
        }
        .dragging * {
          transition: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {/* Widget Container */}
        <div
          className={`relative z-10 w-[420px] ${isDragging ? '' : 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'} bg-white rounded-[24px] border border-gray-200 flex pt-3 px-3 pb-0 shadow-[0_4px_0_rgb(229,231,235)] ${expanded ? 'max-h-[560px]' : 'max-h-[100px]'} ${isReversed ? 'flex-col-reverse' : 'flex-col'}`}
        >


          {/* Input & Handle area - always Input on Top, Grip on Bottom */}
          <div className="flex flex-col shrink-0">
            {/* Header - Input form */}
            <div className="flex items-center gap-2 h-10 relative">
              <button
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 shadow-[0_2px_0_rgb(229,231,235)] text-gray-400 hover:bg-gray-50 hover:border-gray-200 hover:shadow-[0_2px_0_rgb(209,213,219)] active:shadow-[0_0px_0_rgb(209,213,219)] active:translate-y-[2px] transition-all cursor-pointer shrink-0"
                onClick={() => {
                  setExpanded(!expanded)
                  if (showSettings) setShowSettings(false)
                }}
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${expanded ? (isReversed ? 'rotate-0' : 'rotate-180') : (isReversed ? 'rotate-180' : 'rotate-0')} text-gray-500`} strokeWidth={2.5} />
              </button>

              <input
                type="text"
                placeholder="Nueva tarea..."
                className="flex-1 bg-gray-50 text-gray-800 text-sm placeholder-gray-400 outline-none font-semibold rounded-xl border border-gray-200 px-3 py-1.5 h-9 focus:border-gray-300 focus:bg-white transition-colors"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTask()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(true)
                  setShowSettings(false)
                }}
              />

              <div className="flex items-center gap-1.5 relative shrink-0">
                <button
                  className={`w-9 h-9 transition-all rounded-xl flex items-center justify-center border ${showSettings ? 'border-[var(--theme-bg)] text-[var(--theme-text)] bg-[var(--theme-bg)] shadow-[0_2px_0_var(--theme-shadow)] active:translate-y-[2px] active:shadow-[0_0px_0_var(--theme-shadow)]' : 'shadow-[0_2px_0_rgb(229,231,235)] bg-white border-gray-200 text-gray-500 hover:bg-gray-50 active:shadow-[0_0px_0_rgb(209,213,219)] active:translate-y-[2px]'}`}
                  onClick={() => showSettings ? setShowSettings(false) : openSettings()}
                >
                  <Settings className="w-4 h-4" strokeWidth={2.5} />
                </button>

                <div className="relative flex items-center justify-center">
                  <button
                    ref={newCalendarBtnRef}
                    className={`w-9 h-9 transition-all rounded-xl flex items-center justify-center border ${selectedDate || showCalendar ? 'border-[var(--theme-bg)] text-[var(--theme-text)] bg-[var(--theme-bg)] shadow-[0_2px_0_var(--theme-shadow)] active:translate-y-[2px] active:shadow-[0_0px_0_var(--theme-shadow)]' : 'bg-white border-gray-200 shadow-[0_2px_0_rgb(229,231,235)] text-gray-500 hover:bg-gray-50 active:shadow-[0_0px_0_rgb(209,213,219)] active:translate-y-[2px]'}`}
                    onClick={() => {
                      if (!showCalendar && newCalendarBtnRef.current) {
                        const rect = newCalendarBtnRef.current.getBoundingClientRect()
                        setNewCalendarPos({ x: rect.left + rect.width / 2, y: rect.bottom })
                        if (!expanded) setExpanded(true)
                      }
                      setShowCalendar(!showCalendar)
                    }}
                  >
                    <Calendar className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                <button
                  onClick={addTask}
                  className="w-9 h-9 bg-[var(--theme-bg)] border border-[var(--theme-bg)] hover:bg-[var(--theme-hover)] text-[var(--theme-text)] rounded-xl flex items-center justify-center transition-all shadow-[0_2px_0_var(--theme-shadow)] active:shadow-[0_0px_0_var(--theme-shadow)] active:translate-y-[2px]"
                >
                  <Plus className="w-5 h-5" strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Handle area - JS-based dragging for perfect cursor and hover interaction */}
            <div
              ref={gripRef}
              onMouseDown={handleDragStart}
              className="relative flex justify-center items-center h-8 w-12 group mx-auto cursor-grab active:cursor-grabbing transition-all select-none"
            >
              <GripVertical className="text-gray-300 rotate-90 transition-all duration-200 group-hover:text-gray-600 group-active:text-gray-900" size={18} strokeWidth={3} />
            </div>
          </div>

          {/* Dynamic Content Area with Smart Animate Grid Trick */}
          <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden min-h-0">
              <div className={`flex flex-col gap-2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? 'translate-y-0' : (isReversed ? 'translate-y-8' : '-translate-y-8')} max-h-[380px] overflow-y-auto px-1 custom-scrollbar ${isReversed ? 'pb-2' : 'mt-2 pb-4'} no-drag-region`}>





                {showSettings ? (
                  <div className="flex flex-col gap-3 p-1 animate-in fade-in slide-in-from-bottom-2 duration-300 no-drag-region">
                    <div className="flex justify-between items-center pr-1">
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5 text-[var(--theme-bg)]" strokeWidth={2.5} /> Ajustes
                      </h3>
                      <button onClick={saveSettings} className="bg-[var(--theme-bg)] border-[var(--theme-bg)] text-[var(--theme-text)] text-[11px] px-3 py-1.5 rounded-lg shadow-[0_2px_0_var(--theme-shadow)] hover:bg-[var(--theme-hover)] active:translate-y-[2px] active:shadow-[0_0px_0_var(--theme-shadow)] transition-all font-bold">
                        Guardar Cambios
                      </button>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-gray-200 flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                        <Palette className="w-5 h-5 text-[var(--theme-bg)]" strokeWidth={2.5} />
                        Personalización
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">Color del Tema</span>
                        <div className="flex gap-1.5">
                          {['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#111827'].map(color => (
                            <button
                              key={color}
                              onClick={() => setDraftThemeColor(color)}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${draftThemeColor === color ? 'scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                              style={{
                                backgroundColor: color,
                                borderColor: draftThemeColor === color ? darkenHex(color, 60) : 'transparent'
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 font-medium">Aviso Próx. (días)</span>
                        <input type="number" min="0" className="w-12 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-center py-1 outline-none focus:border-gray-300" value={draftDaysWarning} onChange={e => setDraftDaysWarning(e.target.value)} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 font-medium">Aviso Urgente (días)</span>
                        <input type="number" min="0" className="w-12 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-center py-1 outline-none focus:border-gray-300" value={draftDaysUrgent} onChange={e => setDraftDaysUrgent(e.target.value)} />
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-gray-200 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                        <GoogleCalendarLogo className="w-5 h-5" />
                        Google Calendar
                      </div>
                      <p className="text-xs text-gray-500 font-medium leading-tight">
                        {isGoogleConnected
                          ? `Vinculado a: ${userEmail || 'cuenta de Google'}`
                          : 'Sincroniza tus tareas automáticamente con tus eventos.'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {isGoogleConnected ? (
                          <>
                            <button
                              onClick={() => syncTasksToGoogle(tasks)}
                              disabled={isSyncing}
                              className="text-xs bg-[var(--theme-bg)] border border-[var(--theme-bg)] text-[var(--theme-text)] font-extrabold shadow-[0_2px_0_var(--theme-shadow)] hover:bg-[var(--theme-hover)] active:translate-y-[2px] active:shadow-[0_0px_0_var(--theme-shadow)] rounded-lg py-2 px-3 transition-all min-w-[80px]"
                            >
                              {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                            </button>
                            <button
                              onClick={handleGoogleLogout}
                              className="text-xs bg-white border border-gray-200 text-red-500 font-extrabold hover:bg-red-50 active:translate-y-[2px] active:shadow-none shadow-[0_2px_0_rgb(229,231,235)] rounded-lg py-2 px-3 transition-all"
                            >
                              Desvincular
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleGoogleLogin}
                            className="text-xs bg-white border border-gray-200 shadow-[0_2px_0_rgb(229,231,235)] text-gray-700 font-bold hover:bg-gray-50 active:shadow-[0_0px_0_rgb(229,231,235)] active:translate-y-[2px] rounded-lg py-2 px-3 transition-all w-max"
                          >
                            Vincular Cuenta
                          </button>
                        )}
                      </div>

                      {showGoogleCredentials && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-2">
                          <p className="text-[10px] font-bold text-gray-700">Configura tus credenciales de Google Cloud:</p>
                          <input
                            type="password"
                            placeholder="Client ID"
                            className="bg-white border border-gray-200 rounded-lg text-xs p-2 outline-none focus:border-[var(--theme-bg)]"
                            value={tempClientId}
                            onChange={e => setTempClientId(e.target.value)}
                          />
                          <input
                            type="password"
                            placeholder="Client Secret"
                            className="bg-white border border-gray-200 rounded-lg text-xs p-2 outline-none focus:border-[var(--theme-bg)]"
                            value={tempClientSecret}
                            onChange={e => setTempClientSecret(e.target.value)}
                          />
                          <button
                            onClick={saveCredentials}
                            className="bg-[var(--theme-bg)] text-[var(--theme-text)] text-[10px] font-bold py-2 rounded-lg"
                          >
                            Conectar Google
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                        <LayoutPanelLeft className="w-5 h-5 text-[var(--theme-bg)]" strokeWidth={2.5} />
                        Posición
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => { changePosition('top-center'); setIsAddingPosition(false); }}
                          className="flex-1 p-2 rounded-lg text-xs font-bold transition-all text-center border-2 border-solid shadow-[0_2px_0_rgb(229,231,235)] active:shadow-none active:translate-y-[2px] no-drag-region"
                          style={{
                            backgroundColor: widgetPosition === 'top-center' ? 'var(--theme-bg)' : 'white',
                            borderColor: widgetPosition === 'top-center' ? 'var(--theme-bg)' : '#e5e7eb',
                            color: widgetPosition === 'top-center' ? 'var(--theme-text)' : '#4b5563',
                            boxShadow: widgetPosition === 'top-center' ? '0 2px_0 var(--theme-shadow)' : '0 2px_0 rgb(229,231,235)'
                          }}
                        >
                          Centrar Arriba
                        </button>
                        {localStorage.getItem('customBounds') ? (
                          <button
                            onClick={() => { restoreCustomPosition(); setIsAddingPosition(false); }}
                            className="flex-1 p-2 rounded-lg text-xs font-bold transition-all text-center border-2 border-solid shadow-[0_2px_0_rgb(229,231,235)] active:shadow-none active:translate-y-[2px] no-drag-region"
                            style={{
                              backgroundColor: widgetPosition === 'custom' ? 'var(--theme-bg)' : 'white',
                              borderColor: widgetPosition === 'custom' ? 'var(--theme-bg)' : '#e5e7eb',
                              color: widgetPosition === 'custom' ? 'var(--theme-text)' : '#4b5563',
                              boxShadow: widgetPosition === 'custom' ? '0 2px_0 var(--theme-shadow)' : '0 2px_0 rgb(229,231,235)'
                            }}
                          >
                            Posición 1
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsAddingPosition(true)}
                            className="flex-1 p-2 rounded-lg text-xs font-bold transition-all text-center border-2 border-dotted no-drag-region"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--theme-bg) 15%, transparent)',
                              borderColor: 'var(--theme-bg)',
                              color: 'var(--theme-bg)'
                            }}
                          >
                            {isAddingPosition ? '...' : 'Agregar Posición'}
                          </button>
                        )}
                      </div>

                      {localStorage.getItem('customBounds') && !isAddingPosition && (
                        <button
                          onClick={() => setIsAddingPosition(true)}
                          className="mt-1 text-[10px] font-bold text-gray-400 hover:text-[var(--theme-bg)] transition-colors w-full text-center py-1 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 no-drag-region"
                        >
                          Editar Posición 1
                        </button>
                      )}

                      {isAddingPosition && (
                        <div className="mt-2 animate-in slide-in-from-top-2 fade-in duration-300">
                          <p className="text-[10px] text-gray-500 font-bold mb-1 text-center">¡Mueve el widget a donde quieras!</p>
                          <button
                            onClick={saveCustomPosition}
                            className="w-full p-2 bg-[var(--theme-bg)] text-[var(--theme-text)] shadow-[0_2px_0_var(--theme-shadow)] hover:bg-[var(--theme-hover)] active:shadow-[0_0px_0_var(--theme-shadow)] active:translate-y-[2px] rounded-lg text-xs font-bold transition-all no-drag-region"
                            style={{
                              backgroundColor: 'var(--theme-bg)',
                              color: 'var(--theme-text)',
                              borderColor: 'var(--theme-bg)',
                              boxShadow: '0 2px 0 var(--theme-shadow)'
                            }}
                          >
                            Aplicar Ubicación
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-8 gap-1">
                        <p className="text-gray-400 font-bold text-base">¡Todo al día!</p>
                        <p className="text-gray-400 text-xs font-medium">Agrega una tarea para comenzar.</p>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={() => toggleTask(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          daysWarning={daysWarning}
                          daysUrgent={daysUrgent}
                          isEditingText={editingTextId === task.id}
                          editingValue={editingValue}
                          setEditingValue={setEditingValue}
                          onStartEdit={() => {
                            setEditingTextId(task.id);
                            setEditingValue(task.text);
                          }}
                          onFinishEdit={() => updateTaskText(task.id, editingValue)}
                          onEditDateClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setEditingTaskId(task.id);
                            setCalendarPos({ x: rect.left + rect.width / 2, y: rect.bottom });
                            setShowSettings(false);
                            setExpanded(true);
                          }}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Counter Ribbon */}
        <div className={`absolute z-0 bg-[var(--theme-bg)] border border-[var(--theme-bg)] text-[var(--theme-text)] font-bold text-[10px] px-5 shadow-[0_3px_0_var(--theme-shadow)] ${isDragging ? '' : 'transition-all duration-500 ease-in-out'} whitespace-nowrap ${isReversed
          ? 'bottom-[calc(100%-16px)] pb-6 pt-1.5 rounded-t-[16px]'
          : 'top-[calc(100%-16px)] pt-6 pb-1.5 rounded-b-[16px]'
          }`}>
          {statusText}
        </div>

        {showCalendar && (
          <div className="fixed inset-0 z-[100] no-drag-region pointer-events-none">
            <div className="fixed inset-0 cursor-auto pointer-events-auto" onClick={() => setShowCalendar(false)}></div>
            <div
              className="absolute pointer-events-auto"
              style={{
                top: isReversed
                  ? Math.max(20, newCalendarPos.y - 308)
                  : Math.min(newCalendarPos.y + 8, Math.max(window.innerHeight, 640) - 320),
                left: Math.max(20, Math.min(newCalendarPos.x - 120, window.innerWidth - 260))
              }}
            >
              <CalendarDropdown
                selectedDate={selectedDate}
                onSelect={(d: string) => setSelectedDate(d)}
                onClose={() => setShowCalendar(false)}
                isBottom={false}
                isModal={true}
              />
            </div>
          </div>
        )}

        {editingTaskId && (
          <div className="fixed inset-0 z-[100] no-drag-region pointer-events-none">
            <div className="fixed inset-0 cursor-auto pointer-events-auto" onClick={() => setEditingTaskId(null)}></div>
            <div
              className="absolute pointer-events-auto"
              style={{
                top: isReversed
                  ? Math.max(20, calendarPos.y - 308)
                  : Math.min(calendarPos.y + 8, window.innerHeight - 320),
                left: Math.max(20, Math.min(calendarPos.x - 120, window.innerWidth - 260))
              }}
            >
              <CalendarDropdown
                selectedDate={""}
                onSelect={(d: string) => { updateTaskDate(editingTaskId, d); setEditingTaskId(null); }}
                onClose={() => setEditingTaskId(null)}
                isBottom={false}
                isModal={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskItem({
  task, onToggle, onDelete, daysWarning, daysUrgent, onEditDateClick,
  isEditingText, editingValue, setEditingValue, onStartEdit, onFinishEdit
}: {
  task: Task, onToggle: () => void, onDelete: () => void, daysWarning: number,
  daysUrgent: number, onEditDateClick: (e: React.MouseEvent) => void,
  isEditingText: boolean, editingValue: string, setEditingValue: (v: string) => void,
  onStartEdit: () => void, onFinishEdit: () => void
}) {
  let dateColorClass = "bg-gray-100 text-gray-400 border-transparent"
  let iconWarning = null

  if (!task.completed && task.date) {
    const parts = task.date.split('/')
    if (parts.length === 3) {
      const taskDate = new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 3600 * 24))

      if (diffDays <= daysUrgent) {
        dateColorClass = "bg-red-100 text-red-600 border-red-200"
        iconWarning = <AlertTriangle className="w-3 h-3 mr-0.5 inline" />
      } else if (diffDays <= daysWarning) {
        dateColorClass = "bg-yellow-100 text-yellow-600 border-yellow-200"
        iconWarning = <Clock className="w-3 h-3 mr-0.5 inline" />
      }
    }
  }

  return (
    <div
      onClick={onToggle}
      className={`relative flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-[14px] no-drag-region group transition-all cursor-pointer hover:bg-gray-50 active:translate-y-[2px] active:shadow-[0_0px_0_rgb(229,231,235)] bg-white ${task.completed
        ? 'shadow-[0_0px_0_rgb(229,231,235)] translate-y-[2px] bg-gray-50/50'
        : 'shadow-[0_2px_0_rgb(229,231,235)]'
        }`}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 no-drag-region ${task.completed
          ? 'bg-[var(--theme-bg)] border-2 border-[var(--theme-bg)] text-[var(--theme-text)]'
          : 'bg-white border-2 border-gray-300'
          }`}
      >
        {task.completed && <Check className="w-3.5 h-3.5 stroke-[4]" />}
      </div>

      {isEditingText ? (
        <div className="relative inline-grid items-center min-w-[50px] max-w-full no-drag-region h-8">
          <span className="invisible px-4 text-[14px] font-semibold whitespace-pre pointer-events-none">
            {editingValue || ' '}
          </span>
          <input
            autoFocus
            className="absolute inset-0 w-full h-full text-[14px] font-semibold bg-white border border-gray-300 rounded-lg px-2 outline-none text-gray-900 shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={onFinishEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishEdit()
              if (e.key === 'Escape') onStartEdit()
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <span
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className={`text-[14px] w-fit max-w-full block font-semibold overflow-hidden whitespace-nowrap text-ellipsis relative px-2 py-1 rounded-md transition-all no-drag-region ${task.completed ? 'text-gray-400 line-through cursor-default' : 'text-gray-800 hover:text-black hover:bg-gray-100 cursor-pointer'}`}
          >
            {task.text}
          </span>
        </div>
      )}

      {task.date && <div className="relative">
        <span
          onClick={(e) => { e.stopPropagation(); onEditDateClick(e); }}
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center transition-opacity hover:opacity-80 no-drag-region ${task.completed ? 'bg-gray-100 text-gray-400 border-transparent cursor-default pointer-events-none' : dateColorClass + ' cursor-pointer'}`}
        >
          {!task.completed && iconWarning}{task.date}
        </span>
      </div>}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="ml-1 flex items-center justify-center w-7 h-7 text-gray-400 bg-white border border-gray-200 shadow-[0_2px_0_rgb(229,231,235)] hover:text-red-500 hover:border-red-200 hover:bg-red-50 hover:shadow-[0_2px_0_rgb(254,204,204)] active:shadow-[0_0px_0_rgb(254,204,204)] active:translate-y-[2px] rounded-lg transition-all shrink-0 no-drag-region"
      >
        <Trash2 className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function CalendarDropdown({ onSelect, onClose, isBottom, isModal }: any) {
  const [currDate, setCurrDate] = useState(new Date())
  const [showMonthSelect, setShowMonthSelect] = useState(false)
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Sep', 'Oct', 'Nov', 'Dic']

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const year = currDate.getFullYear()
  const month = currDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay()

  const days = []
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const prevMonth = (e: any) => { e.stopPropagation(); setCurrDate(new Date(year, month - 1, 1)) }
  const nextMonth = (e: any) => { e.stopPropagation(); setCurrDate(new Date(year, month + 1, 1)) }

  const handleSelect = (e: any, day: number) => {
    e.stopPropagation()
    const mm = (month + 1).toString().padStart(2, '0')
    const dd = day.toString().padStart(2, '0')
    const yy = year.toString().slice(2)
    onSelect(`20${yy}-${mm}-${dd}`)
    onClose()
  }

  return (
    <div
      className={isModal ? 'bg-white border border-gray-200 rounded-2xl p-3 shadow-xl z-[100] w-60 animate-in zoom-in-95 cursor-auto no-drag-region' : `absolute ${isBottom ? 'bottom-[calc(100%+12px)] origin-bottom slide-in-from-bottom-2' : 'top-[calc(100%+22px)] origin-top slide-in-from-top-2'} -right-24 bg-white border border-gray-200 rounded-2xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-50 w-60 animate-in fade-in cursor-auto no-drag-region`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2">
        <button onClick={prevMonth} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-all"><ChevronLeft size={16} strokeWidth={3} /></button>
        <div className="relative flex items-center group cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded-lg transition-colors" onClick={() => setShowMonthSelect(!showMonthSelect)}>
          <span className="font-bold text-gray-800 text-[13px] pl-1 pr-4 select-none">{monthNames[month]} {year}</span>
          <ChevronDown className="w-3 h-3 text-gray-500 absolute right-1.5 transition-transform" style={{ transform: showMonthSelect ? 'rotate(180deg)' : 'rotate(0deg)' }} strokeWidth={3} />
          {showMonthSelect && (
            <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl p-1.5 shadow-lg z-[60] w-28 max-h-48 overflow-y-auto grid grid-cols-1 gap-0.5 [&::-webkit-scrollbar]:hidden" onClick={e => e.stopPropagation()}>
              {monthNames.map((m, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrDate(new Date(year, i, 1)); setShowMonthSelect(false) }}
                  className={`px-2 py-1.5 text-[11px] font-bold rounded-lg transition-colors text-left ${i === month ? 'bg-[var(--theme-bg)] text-[var(--theme-text)]' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={nextMonth} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-all"><ChevronRight size={16} strokeWidth={3} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isToday = d && (new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year);
          if (!d) return <div key={i} />;
          return (
            <button
              key={i}
              onClick={(e) => handleSelect(e, d)}
              className={`hover:bg-[var(--theme-bg)] hover:text-[var(--theme-text)] rounded-lg text-xs font-bold py-1.5 transition-colors block w-full text-center ${isToday ? 'text-[var(--theme-bg)]' : 'text-gray-600'}`}
              style={isToday ? { backgroundColor: 'color-mix(in srgb, var(--theme-bg) 20%, transparent)' } : {}}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  )
}

export default App
