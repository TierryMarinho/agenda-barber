import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import SuperAdminDashboard from './SuperAdminDashboard'
import AdminDashboard from './AdminDashboard'
import BasicoDashboard from './BasicoDashboard'

export default function App() {
  const [session,    setSession]    = useState(null)
  const [usuario,    setUsuario]    = useState(null)
  const [empresa,    setEmpresa]    = useState(null)
  const [accessError, setAccessError] = useState('')
  const [loadingApp, setLoadingApp] = useState(Boolean(supabase))

  const [isDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('soultech_theme')
    if (savedTheme) return savedTheme === 'dark'
    return false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
    document.body.classList.toggle('dark', isDarkMode)
    localStorage.setItem('soultech_theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    if (!supabase) return
    let isMounted = true
    let authEventReceived = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      authEventReceived = true
      setSession(nextSession)
      setLoadingApp(false)
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted || authEventReceived) return
      if (error) console.error('Erro ao recuperar sessão:', error)
      setSession(error ? null : data.session)
      setLoadingApp(false)
    }).catch((error) => {
      if (!isMounted || authEventReceived) return
      console.error('Erro ao recuperar sessão:', error)
      setLoadingApp(false)
    })

    return () => { isMounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    let isMounted = true

    const carregarAcesso = async () => {
      setLoadingApp(true)
      setAccessError('')
      setUsuario(null)
      setEmpresa(null)
      try {
        const email = session.user.email?.trim().toLowerCase()
        if (!email) throw new Error('Sua conta não possui um e-mail de acesso.')

        // O banco legado também identifica perfis pelo e-mail autenticado.
        const { data: perfil, error } = await supabase.from('usuarios')
          .select('id, nome, email, role, empresa_id, profissional_id')
          .eq('email', email).maybeSingle()
        if (!isMounted) return
        if (error) throw new Error('Não foi possível consultar seu perfil. Tente entrar novamente.')
        if (!perfil) throw new Error('Sua conta está autenticada, mas ainda não possui um perfil no sistema.')
        if (!['superadmin', 'admin', 'basico'].includes(perfil.role)) {
          throw new Error('Seu perfil não possui uma permissão de acesso válida.')
        }

        if (perfil.role !== 'superadmin') {
          if (!perfil.empresa_id) throw new Error('Seu perfil ainda não está vinculado a uma empresa.')
          const { data: empresaAtual, error: empresaError } = await supabase.from('empresas')
            .select('*').eq('id', perfil.empresa_id).maybeSingle()
          if (!isMounted) return
          if (empresaError) throw new Error('Não foi possível consultar sua empresa. Tente entrar novamente.')
          if (!empresaAtual) throw new Error('A empresa vinculada não foi encontrada ou seu acesso não está autorizado.')
          if (empresaAtual.ativo !== true) throw new Error('O acesso desta empresa está suspenso.')
          if (perfil.role === 'basico' && !perfil.profissional_id) {
            throw new Error('Seu perfil ainda não está vinculado a um profissional.')
          }
          setEmpresa(empresaAtual)
        }
        setUsuario(perfil)
      } catch (error) {
        if (isMounted) setAccessError(error.message)
      } finally {
        if (isMounted) setLoadingApp(false)
      }
    }

    carregarAcesso()
    return () => { isMounted = false }
  }, [session])

  if (loadingApp) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#fafafa] dark:bg-[#09090b] gap-3">
        <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Login />

  if (accessError || !usuario) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#fafafa] dark:bg-[#09090b] p-4">
        <div role="alert" className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Acesso ao sistema</h3>
          <p className="text-sm text-zinc-500 mb-6">{accessError || 'Carregando seu perfil...'}</p>
          <button onClick={() => supabase.auth.signOut()} className="w-full py-2.5 px-4 bg-zinc-900 text-white text-sm font-semibold rounded-xl cursor-pointer">
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  if (usuario.role === 'superadmin') return <SuperAdminDashboard />
  if (usuario.role === 'basico') return <BasicoDashboard empresa={empresa} usuario={usuario} />
  return <AdminDashboard empresa={empresa} usuario={usuario} />
}
