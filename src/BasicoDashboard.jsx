import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Agenda from './Agenda'

export default function BasicoDashboard({ empresa, usuario }) {
  const [abaAtiva, setAbaAtiva] = useState(() => {
    return sessionStorage.getItem('soultech_basico_aba') || 'agenda'
  })

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('soultech_theme') === 'dark'
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
      localStorage.setItem('soultech_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
      localStorage.setItem('soultech_theme', 'light')
    }
  }, [isDarkMode])

  useEffect(() => {
    sessionStorage.setItem('soultech_basico_aba', abaAtiva)
  }, [abaAtiva])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors">

      {/* Cabeçalho */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 dark:bg-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              AB
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Agenda Barber
              </h1>
              <span className="hidden sm:inline-block text-slate-300 dark:text-slate-700">/</span>
              <span className="hidden sm:inline-block text-sm font-medium text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                {empresa?.nome}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {usuario?.nome || usuario?.email}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold uppercase tracking-wider">
                Profissional
              </span>
            </div>

            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/50 rounded-lg transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {empresa?.nome}
            </h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              empresa?.ativo
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50'
                : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/60 dark:border-red-800/50'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${empresa?.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {empresa?.ativo ? 'Online' : 'Inativo'}
            </span>
          </div>

          <div className="animate-fade-in">
            <Agenda empresaId={empresa?.id} usuario={usuario} />
          </div>
        </div>
      </main>
    </div>
  )
}
