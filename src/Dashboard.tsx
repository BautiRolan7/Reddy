import React, { useState, useEffect } from 'react'
import { Shield, Power, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, RefreshCw } from 'lucide-react'


const TERMS = `Reddy es una aplicación gratuita de productividad personal.

1. Uso personal: Reddy está diseñado para uso personal y no comercial.

2. Sincronización: Al conectar tu cuenta de Google, Reddy accede a Google Tasks y Google Calendar únicamente para crear, leer, actualizar y eliminar las tareas que vos gestionás en el widget.

3. Sin recopilación de datos: Reddy no envía ningún dato a servidores propios. Todos los datos se almacenan localmente en tu computadora o en tu cuenta de Google.

4. Sin garantías: Reddy se provee "tal cual", sin garantías de disponibilidad o exactitud. El desarrollador no se responsabiliza por pérdida de datos.

5. Actualizaciones: El software puede actualizarse con nuevas funciones. El uso continuado implica aceptación de los nuevos términos.`

const PRIVACY = `¿Qué datos usa Reddy?

• Tareas locales: Se guardan en tu computadora en una carpeta de datos de la aplicación.

• Google Tasks y Calendar: Reddy usa OAuth 2.0 para conectarse a tu cuenta. Tus credenciales nunca se almacenan en texto plano — solo se guarda el token de acceso encriptado localmente.

• Scopes de Google: Reddy solicita acceso a Google Tasks, Google Calendar y tu email para identificar la cuenta.

• Sin telemetría: Reddy no recopila estadísticas de uso, no tiene analíticas, y no se comunica con ningún servidor externo propio.

• Inicio automático: El registro de inicio automático de Windows se modifica solo si vos lo habilitás.`

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2 font-medium text-gray-700 text-sm">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-white text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [autostart, setAutostart] = useState<boolean | null>(null)
  const [toggling, setToggling] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getAutostart().then(setAutostart)
    window.electronAPI.getGoogleUser().then(u => {
      if (u.loggedIn && u.email) setGoogleEmail(u.email)
    })
  }, [])

  const handleToggleAutostart = async () => {
    if (!window.electronAPI || toggling) return
    setToggling(true)
    const newValue = !autostart
    const res = await window.electronAPI.setAutostart(newValue)
    setAutostart(res.enabled)
    setToggling(false)
  }

  const handleUninstall = async () => {
    if (!window.electronAPI || uninstalling) return
    setUninstalling(true)
    await window.electronAPI.uninstallApp()
    setUninstalling(false)
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center font-bold text-white text-lg">R</div>
          <div>
            <h1 className="text-lg font-bold leading-none">Reddy</h1>
            <p className="text-xs text-gray-400 mt-0.5">Panel de control</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">

        {/* Auto-start */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Power className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-sm text-gray-800">Inicio automático con Windows</span>
            </div>
            <button
              onClick={handleToggleAutostart}
              disabled={toggling || autostart === null}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                autostart ? 'bg-green-500' : 'bg-gray-300'
              } ${toggling ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  autostart ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            {autostart === null ? (
              <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
            ) : autostart ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={`text-xs ${autostart ? 'text-green-600' : 'text-gray-500'}`}>
              {autostart === null
                ? 'Verificando...'
                : autostart
                ? 'Reddy se inicia automáticamente con Windows'
                : 'Inicio automático desactivado'}
            </span>
          </div>

          {autostart && (
            <p className="text-xs text-gray-400 mt-1.5">
              La próxima vez que inicies tu PC, Reddy arrancará solo. No hace falta abrir el .exe de nuevo.
            </p>
          )}
        </div>

        {/* Google Account */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(3.75 3.75)">
                <path fill="#4285F4" d="M120 96.3H64.7v15.6H104c-1.6 8.6-9.6 25.2-39.3 25.2-23.6 0-42.9-19.5-42.9-43.6S41.1 49.9 64.7 49.9c13.4 0 22.5 5.7 27.6 10.7l18.8-18.1C99.5 30.6 83.4 23.3 64.7 23.3 29 23.3 0 52.3 0 88s29 64.7 64.7 64.7c37.3 0 62.2-26.2 62.2-63.2 0-4.2-.5-7.5-1.1-10.7H120v17.5z"/>
              </g>
            </svg>
            <span className="font-semibold text-sm text-gray-800">Cuenta de Google</span>
          </div>
          {googleEmail ? (
            <p className="text-xs text-gray-600">
              Conectado como <span className="font-medium text-gray-800">{googleEmail}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500">No hay cuenta conectada. Abrí el widget para conectar Google.</p>
          )}
        </div>

        {/* Collapsible sections */}
        <Section title="Seguridad y privacidad" icon={<Shield className="w-4 h-4 text-gray-500" />}>
          {PRIVACY}
        </Section>

        <Section title="Términos de uso" icon={<span className="text-gray-500 text-xs font-bold">§</span>}>
          {TERMS}
        </Section>

        {/* Uninstall */}
        <div className="border border-red-100 rounded-xl p-4 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-sm text-red-700">Desinstalar Reddy</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Elimina todos los datos locales y desactiva el inicio automático. Deberás borrar el archivo .exe manualmente.
          </p>
          <button
            onClick={handleUninstall}
            disabled={uninstalling}
            className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {uninstalling ? 'Desinstalando...' : 'Desinstalar'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-1">
          Reddy v1.0 — reddywidget@gmail.com
        </p>
      </div>
    </div>
  )
}
