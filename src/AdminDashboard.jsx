import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Agenda from './Agenda'
import Configuracoes from './Configuracoes'
import Clientes from './Clientes'
import Dashboard from './Dashboard'
import ConexaoWhatsApp from './ConexaoWhatsApp'
import Financeiro from './Financeiro'

export default function AdminDashboard({ empresa, usuario }) {
  const [abaAtiva, setAbaAtiva] = useState(() => {
    return sessionStorage.getItem('soultech_admin_aba') || 'dashboard'
  })

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const [pendencias, setPendencias] = useState([])
  const [modalPendencias, setModalPendencias] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  const [comissoesMap, setComissoesMap] = useState({})
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [checkoutData, setCheckoutData] = useState({
    id: null, profissional: '', nome_cliente: '', forma_pagamento: 'pix', valor_cobrado: 0, valor_comissao_original: 0
  })

  useEffect(() => {
    sessionStorage.setItem('soultech_admin_aba', abaAtiva)
  }, [abaAtiva])

  useEffect(() => {
    if (empresa?.id) {
      buscarPendencias(empresa.id)
      buscarComissoes(empresa.id)
    }
  }, [empresa])

  const buscarComissoes = async (idEmpresa) => {
    const { data } = await supabase.from('profissionais').select('nome, percentual_comissao').eq('empresa_id', idEmpresa)
    if (data) {
      const mapa = {}
      data.forEach(p => mapa[p.nome] = p.percentual_comissao || 0)
      setComissoesMap(mapa)
    }
  }

  const buscarPendencias = async (idEmpresa) => {
    const agora = new Date()
    const agoraLocal = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ')

    const { data, error } = await supabase
      .from('agendamentos')
      .select('id, nome_cliente, servico, profissional, data_hora, valor, valor_comissao')
      .eq('empresa_id', idEmpresa)
      .eq('status', 'ativo')
      .lt('data_hora', agoraLocal)
      .order('data_hora', { ascending: true })

    if (!error && data) setPendencias(data)
  }

  const resolverPendencia = async (idAgendamento, novoStatus) => {
    setIsResolving(true)
    let statusPag = novoStatus === 'cancelado' ? 'cancelado' : 'pendente'

    const { error } = await supabase
      .from('agendamentos')
      .update({ status: novoStatus, status_pagamento: statusPag })
      .eq('id', idAgendamento)
      .eq('empresa_id', empresa.id)

    if (error) {
      alert('Erro ao atualizar. Tente novamente.')
    } else {
      const novas = pendencias.filter(p => p.id !== idAgendamento)
      setPendencias(novas)
      if (novas.length === 0) setModalPendencias(false)
    }
    setIsResolving(false)
  }

  const abrirCheckout = (pendencia) => {
    setCheckoutData({
      id: pendencia.id,
      profissional: pendencia.profissional,
      nome_cliente: pendencia.nome_cliente,
      forma_pagamento: 'pix',
      valor_cobrado: pendencia.valor || 0,
      valor_comissao_original: pendencia.valor_comissao || 0
    })
    setIsCheckoutOpen(true)
  }

  const confirmarCheckout = async (e) => {
    e.preventDefault()
    setIsResolving(true)

    try {
      const percComissao = comissoesMap[checkoutData.profissional] || 0
      let valorComissaoReal = checkoutData.valor_comissao_original

      if (percComissao > 0) {
        valorComissaoReal = (checkoutData.valor_cobrado * (percComissao / 100)).toFixed(2)
      }

      const { error } = await supabase.from('agendamentos').update({
        status: 'concluido',
        forma_pagamento: checkoutData.forma_pagamento,
        status_pagamento: 'pago',
        valor: checkoutData.valor_cobrado,
        valor_comissao: valorComissaoReal
      }).eq('id', checkoutData.id).eq('empresa_id', empresa.id)

      if (error) {
        alert("Falha ao registrar pagamento no banco de dados.")
      } else {
        const novas = pendencias.filter(p => p.id !== checkoutData.id)
        setPendencias(novas)
        setIsCheckoutOpen(false)
        if (novas.length === 0) setModalPendencias(false)
      }
    } finally {
      setIsResolving(false)
    }
  }

  const percAtual = comissoesMap[checkoutData.profissional] || 0
  const repasseExibicao = percAtual > 0
    ? (checkoutData.valor_cobrado * (percAtual / 100)).toFixed(2)
    : Number(checkoutData.valor_comissao_original || 0).toFixed(2)

  const navGroups = [
    {
      title: 'Operação',
      items: [
        {
          name: 'dashboard',
          label: 'Visão Geral',
          subtitle: 'Indicadores de performance e agenda em tempo real',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )
        },
        {
          name: 'agenda',
          label: 'Agenda & Horários',
          subtitle: 'Grade interativa de profissionais, encaixes e bloqueios',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )
        },
        {
          name: 'clientes',
          label: 'Base de Clientes',
          subtitle: 'CRM, histórico de contatos e controle de permissões',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )
        },
      ]
    },
    {
      title: 'Gestão & IA',
      items: [
        {
          name: 'financeiro',
          label: 'Gestão Financeira',
          subtitle: 'Fluxo de caixa, despesas fixas/parceladas e repasse de comissões',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        },
        {
          name: 'whatsapp',
          label: 'Automação WhatsApp',
          subtitle: 'Status da sessão e pareamento do assistente virtual',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )
        },
        {
          name: 'configuracoes',
          label: 'Ajustes do Sistema',
          subtitle: 'Expediente, catálogo de serviços, equipe e credenciais',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )
        }
      ]
    }
  ]

  const allItems = navGroups.flatMap(g => g.items)
  const activeItemObj = allItems.find(i => i.name === abaAtiva) || allItems[0]

  const dataFormatadaHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans flex">

      {/* OVERLAY MOBILE */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* SIDEBAR EXECUTIVA (#09090b) */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#09090b] text-zinc-300 border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-200 ease-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div>
          {/* TOPO: BRAND + WORKSPACE */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-950 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Tesoura de barbearia">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="m8.12 8.12 12.88 12.88M14 10l7-7M8.12 15.88 12 12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-white">Agenda Barber</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* ALERTA DE PENDÊNCIAS NA SIDEBAR */}
          {pendencias.length > 0 && (
            <div className="px-3 pt-4">
              <button
                onClick={() => { setModalPendencias(true); setMobileMenuOpen(false) }}
                className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Caixa Pendente
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                    {pendencias.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 font-medium group-hover:text-white">
                  Validar atendimentos &rarr;
                </p>
              </button>
            </div>
          )}

          {/* NAVEGAÇÃO AGRUPADA */}
          <div className="px-3 py-5 space-y-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {group.title}
                </p>
                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = abaAtiva === item.name
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setAbaAtiva(item.name)
                          setMobileMenuOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-950/70 text-white border border-blue-800/60 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={isActive ? 'text-blue-400' : 'text-zinc-500'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                      </button>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* RODAPÉ DA SIDEBAR: USUÁRIO + TEMA + LOGOUT */}
        <div className="p-3 border-t border-zinc-800/80 space-y-2 bg-zinc-950/50">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(usuario?.nome || usuario?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {usuario?.nome || 'Administrador'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {usuario?.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full py-2 px-3 rounded-lg border border-zinc-800 hover:border-red-900/60 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL DIREITA */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOPBAR CONTEXTUAL */}
        <header className="h-16 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white truncate">
                  {activeItemObj.label}
                </h1>
                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  empresa.ativo
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/60 dark:border-red-800/50'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${empresa.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {empresa.ativo ? 'Sistema Online' : 'Inativo'}
                </span>
              </div>
              <p className="hidden md:block text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {activeItemObj.subtitle}
              </p>
            </div>
          </div>

          {/* AÇÕES RÁPIDAS DO TOPO */}
          <div className="flex items-center gap-2.5">
            {pendencias.length > 0 && (
              <button
                onClick={() => setModalPendencias(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100/70 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>{pendencias.length} {pendencias.length === 1 ? 'pendência' : 'pendências'}</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-600 dark:text-zinc-300 capitalize">
              <svg className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dataFormatadaHoje}
            </div>

            {abaAtiva !== 'agenda' && (
              <button
                onClick={() => setAbaAtiva('agenda')}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                Ver Agenda
              </button>
            )}
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {abaAtiva === 'dashboard'     && <Dashboard empresa={empresa} onNavigate={setAbaAtiva} />}
          {abaAtiva === 'financeiro'    && <Financeiro empresaId={empresa.id} />}
          {abaAtiva === 'agenda'        && <Agenda empresaId={empresa.id} usuario={usuario} />}
          {abaAtiva === 'clientes'      && <Clientes empresaId={empresa.id} />}
          {abaAtiva === 'whatsapp'      && <ConexaoWhatsApp empresaId={empresa.id} />}
          {abaAtiva === 'configuracoes' && <Configuracoes empresa={empresa} />}
        </main>
      </div>

      {/* MODAL PRINCIPAL DE PENDÊNCIAS */}
      {modalPendencias && !isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Fechamento de Atendimentos</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Confirme a presença para contabilizar no caixa.</p>
              </div>
              <button onClick={() => setModalPendencias(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {pendencias.map(pend => (
                <div key={pend.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{pend.nome_cliente}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {new Date(pend.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} &bull; {pend.servico} &bull; {pend.profissional}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      R$ {pend.valor || '0.00'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button disabled={isResolving} onClick={() => abrirCheckout(pend)} className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                      Concluído
                    </button>
                    <button disabled={isResolving} onClick={() => resolverPendencia(pend.id, 'ausente')} className="flex-1 py-2 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                      Faltou
                    </button>
                    <button disabled={isResolving} onClick={() => resolverPendencia(pend.id, 'cancelado')} className="flex-1 py-2 px-3 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                      Cancelou
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: CHECKOUT */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
              Fechar Conta
            </h3>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1 mb-4">
              <p className="text-zinc-600 dark:text-zinc-400">
                Profissional: <strong className="text-zinc-900 dark:text-white">{checkoutData.profissional}</strong> ({percAtual > 0 ? percAtual + '%' : 'Pré-calculada'})
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Repasse gerado: <strong className="text-blue-600 dark:text-blue-400">R$ {repasseExibicao}</strong>
              </p>
            </div>

            <form onSubmit={confirmarCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Valor Cobrado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-lg font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  value={checkoutData.valor_cobrado}
                  onChange={e => setCheckoutData({...checkoutData, valor_cobrado: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['pix', 'cartao', 'dinheiro'].map(forma => (
                    <label
                      key={forma}
                      className={`text-center py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        checkoutData.forma_pagamento === forma
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <input type="radio" name="pagamento" value={forma} checked={checkoutData.forma_pagamento === forma} onChange={e => setCheckoutData({...checkoutData, forma_pagamento: e.target.value})} className="hidden" />
                      {forma === 'pix' ? 'Pix' : forma === 'cartao' ? 'Cartão' : 'Dinheiro'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsCheckoutOpen(false)} disabled={isResolving} className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer">
                  Voltar
                </button>
                <button type="submit" disabled={isResolving} className="flex-2 py-2.5 px-4 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  {isResolving ? 'Processando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
