import { useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) {
        setErrorMsg(error.code === 'email_not_confirmed'
          ? 'Confirme seu e-mail antes de entrar.'
          : 'Não foi possível entrar. Confira suas credenciais e tente novamente.')
      }
    } catch {
      setErrorMsg('Não foi possível conectar. Confira sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#09090b] font-sans">

      {/* COLUNA ESQUERDA: BRANDING EXECUTIVO (Preto & Azul Noturno) */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-[#09090b] text-white p-12 xl:p-16 flex-col justify-between border-r border-zinc-900">
        {/* Glow sutil */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-900/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30">
            AB
          </div>
          <span className="text-lg font-bold tracking-tight">
            Agenda Barber
          </span>
        </div>

        {/* Center Pitch */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Agendamentos de barbearia
          </div>
          <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight leading-[1.15] text-white">
            Sua agenda, equipe e financeiro em uma interface limpa e silenciosa.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Sincronização em tempo real com WhatsApp e Google Calendar, cálculo automático de repasses e controle inteligente de horários sem poluição visual.
          </p>

          {/* Mini Preview Cards */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] text-zinc-400 font-medium">Agendamentos IA</p>
              <p className="text-lg font-semibold text-white mt-1">24/7</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] text-zinc-400 font-medium">Comissões</p>
              <p className="text-lg font-semibold text-white mt-1">Automáticas</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] text-zinc-400 font-medium">Google Sync</p>
              <p className="text-lg font-semibold text-emerald-400 mt-1">Tempo Real</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500">
          <span>Agenda Barber &copy; {new Date().getFullYear()}</span>
          <span>Arquitetura Multi-Tenant Segura</span>
        </div>
      </div>

      {/* COLUNA DIREITA: FORMULÁRIO */}
      <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12 bg-[#fafafa] dark:bg-[#09090b]">
        <div className="w-full max-w-sm space-y-7">

          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
              AB
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
              Agenda Barber
            </span>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Bem-vindo de volta
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Insira suas credenciais para acessar o workspace.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div role="status" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
              O acesso está indisponível enquanto a conexão com o banco de dados é configurada.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                E-mail corporativo
              </label>
              <input
                autoComplete="username"
                type="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Senha de acesso
              </label>
              <input
                autoComplete="current-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium text-sm rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Autenticando...' : 'Acessar Workspace'}
            </button>
          </form>



        </div>
      </div>

    </div>
  )
}
