import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function Dashboard({ empresa, onNavigate }) {
  const [resumo, setResumo] = useState({ faturamento: 0, comissoes: 0, agendamentosHoje: 0, concluidosMes: 0 })
  const [equipe, setEquipe] = useState([])
  const [proximosAgendamentos, setProximosAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (empresa?.id) carregarDados()
  }, [empresa])

  const carregarDados = async () => {
    setLoading(true)

    const hoje = new Date().toISOString().split('T')[0]
    const dataAtual = new Date()

    const inicioMesLocal = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-01 00:00:00`

    const { data: agendamentosMes } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresa.id)
      .gte('data_hora', inicioMesLocal)

    if (agendamentosMes) {
      const pagos = agendamentosMes.filter(a => a.status_pagamento === 'pago')
      const faturamentoMes = pagos.reduce((acc, a) => acc + Number(a.valor || 0), 0)
      const comissoesMes = pagos.reduce((acc, a) => acc + Number(a.valor_comissao || 0), 0)
      const hojeAtivos = agendamentosMes.filter(a => a.data_agendamento === hoje && (a.status === 'ativo' || a.status === 'concluido')).length

      setResumo({
        faturamento: faturamentoMes,
        comissoes: comissoesMes,
        agendamentosHoje: hojeAtivos,
        concluidosMes: pagos.length
      })

      const desempenho = {}
      pagos.forEach(ag => {
        if (!desempenho[ag.profissional]) desempenho[ag.profissional] = { nome: ag.profissional, Faturamento: 0, Comissão: 0 }
        desempenho[ag.profissional].Faturamento += Number(ag.valor || 0)
        desempenho[ag.profissional].Comissão += Number(ag.valor_comissao || 0)
      })
      setEquipe(Object.values(desempenho).sort((a, b) => b.Faturamento - a.Faturamento))
    }

    const agora = new Date()
    const agoraLocal = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ')

    const { data: proxData } = await supabase
      .from('agendamentos')
      .select('nome_cliente, servico, data_hora, profissional, hora_fim, valor')
      .eq('empresa_id', empresa.id)
      .eq('status', 'ativo')
      .gte('data_hora', agoraLocal)
      .order('data_hora', { ascending: true })
      .limit(5)

    if (proxData) setProximosAgendamentos(proxData)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Sincronizando indicadores...
      </div>
    )
  }

  const margemRetida = resumo.faturamento - resumo.comissoes
  const ticketMedio = resumo.concluidosMes > 0 ? resumo.faturamento / resumo.concluidosMes : 0

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Indicadores do período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Receita Bruta (Destaque Escuro) */}
        <div className="bg-[#09090b] dark:bg-blue-950/60 border border-zinc-800 dark:border-blue-800/70 rounded-2xl p-5 text-white shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-blue-200">
              Receita Bruta (Mês)
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            R$ {resumo.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-[11px] text-zinc-400 dark:text-blue-200/80">
            {resumo.concluidosMes} atendimentos liquidados
          </p>
        </div>

        {/* Card 2: Receita Retida Casa */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Receita Líquida Casa
            </span>
            <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            R$ {margemRetida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Após dedução de comissões
          </p>
        </div>

        {/* Card 3: Repasse Profissionais */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Repasse Equipe
            </span>
            <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            R$ {resumo.comissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Ticket médio: R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Card 4: Movimento de Hoje */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Agenda de Hoje
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-700 dark:text-blue-400">
              {resumo.agendamentosHoje}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              horários marcados
            </span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Expediente: {empresa.hora_abertura || '08:00'} às {empresa.hora_fechamento || '19:00'}
          </p>
        </div>
      </div>

      {/* Desempenho e próximos atendimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Desempenho da equipe */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Produtividade por Profissional
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Comparativo entre receita gerada e comissões no mês atual
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('financeiro')}
                  className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Relatório completo &rarr;
                </button>
              )}
            </div>

            {equipe.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
                Nenhum faturamento registrado neste mês.
              </div>
            ) : (
              <div className="w-full overflow-x-auto pt-5">
                <div style={{ minWidth: `${Math.max(360, equipe.length * 110)}px`, height: 290 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={equipe} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(value) => `R$${value}`} />
                      <Tooltip
                        cursor={{ fill: 'var(--bg-main)' }}
                        contentStyle={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-main)',
                          borderRadius: '12px',
                          boxShadow: 'var(--shadow-md)',
                          fontSize: '12px'
                        }}
                        formatter={(value) => `R$ ${Number(value).toFixed(2)}`}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '14px', fontSize: '12px', fontWeight: 500 }} />
                      <Bar dataKey="Faturamento" fill="#1e3a8a" radius={[6, 6, 0, 0]} maxBarSize={38} />
                      <Bar dataKey="Comissão" fill="#71717a" radius={[6, 6, 0, 0]} maxBarSize={38} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* RANKING COMPACTO ABAIXO DO GRÁFICO */}
          {equipe.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {equipe.slice(0, 3).map((prof, i) => (
                <div key={prof.nome} className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-blue-950 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {prof.nome}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 shrink-0">
                    R$ {prof.Faturamento.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximos atendimentos */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Fila de Próximos Horários
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Atendimentos futuros confirmados
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold">
                {proximosAgendamentos.length} na fila
              </span>
            </div>

            {proximosAgendamentos.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
                Nenhum agendamento futuro no momento.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {proximosAgendamentos.map((ag, idx) => {
                  const horaInicio = ag.data_hora ? ag.data_hora.split('T')[1]?.substring(0, 5) || ag.data_hora.split(' ')[1]?.substring(0, 5) : ''
                  const horaFim = ag.hora_fim ? ag.hora_fim.substring(0, 5) : ''
                  const iniciais = (ag.nome_cliente || 'C')
                    .split(' ')
                    .slice(0, 2)
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-950/40 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-blue-950 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {iniciais}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {ag.nome_cliente}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {ag.servico} &bull; <span className="text-zinc-700 dark:text-zinc-300 font-medium">{ag.profissional}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200/60 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 font-bold text-xs">
                          {horaInicio}{horaFim ? ` – ${horaFim}` : ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('agenda')}
              className="mt-5 w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Abrir Grade Completa de Horários &rarr;
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
