import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Financeiro({ empresaId }) {
  const [agendamentos, setAgendamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [isProcessando, setIsProcessando] = useState(false)

  const [toast, setToast] = useState(null)

  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().substring(0, 7))
  const [periodoRepasse, setPeriodoRepasse] = useState('mensal')

  const [novaDespesa, setNovaDespesa] = useState({
    descricao: '', valor: '', data_vencimento: new Date().toISOString().split('T')[0], status: 'pendente', tipo: 'unica', parcelas: 12
  })

  const [isModalEditOpen, setIsModalEditOpen] = useState(false)
  const [despesaEditando, setDespesaEditando] = useState(null)
  const [tipoEdicaoDespesa, setTipoEdicaoDespesa] = useState('unica')

  const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false)
  const [despesaExcluindo, setDespesaExcluindo] = useState(null)
  const [tipoRemocaoDespesa, setTipoRemocaoDespesa] = useState('unica')

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (empresaId) carregarCaixa()
  }, [empresaId, mesSelecionado])

  const carregarCaixa = async () => {
    setLoading(true)

    const [anoStr, mesStr] = mesSelecionado.split('-')
    const dataInicioStr = `${anoStr}-${mesStr}-01`
    const ultimoDia = new Date(parseInt(anoStr), parseInt(mesStr), 0).getDate()
    const dataFimStr = `${anoStr}-${mesStr}-${ultimoDia}`

    const { data: agData } = await supabase
      .from('agendamentos')
      .select('id, profissional, servico, valor, valor_comissao, forma_pagamento, data_hora')
      .eq('empresa_id', empresaId)
      .eq('status_pagamento', 'pago')
      .gte('data_hora', `${dataInicioStr} 00:00:00`)
      .lte('data_hora', `${dataFimStr} 23:59:59`)

    if (agData) setAgendamentos(agData)

    const { data: despData } = await supabase
      .from('despesas')
      .select('id, empresa_id, descricao, valor, data_vencimento, status, grupo_id')
      .eq('empresa_id', empresaId)
      .gte('data_vencimento', dataInicioStr)
      .lte('data_vencimento', dataFimStr)
      .order('data_vencimento', { ascending: true })

    if (despData) setDespesas(despData)

    setLoading(false)
  }

  const handleSalvarDespesa = async (e) => {
    e.preventDefault()
    if (!empresaId) return showToast("Erro crítico: ID da empresa não identificado.", "error")

    setIsProcessando(true)
    const valorNumerico = parseFloat(novaDespesa.valor)
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      showToast("Valor inválido. Digite um número maior que zero.", "warning")
      setIsProcessando(false)
      return
    }

    const registros = []
    const qtd = novaDespesa.tipo === 'unica' ? 1 : parseInt(novaDespesa.parcelas)
    const baseDateStr = novaDespesa.data_vencimento

    const grupoId = qtd > 1 ? (crypto.randomUUID?.() || Math.random().toString(36).substring(2,15)) : null

    for (let i = 0; i < qtd; i++) {
      const [year, month, day] = baseDateStr.split('-').map(Number)
      let currentVenc = new Date(year, month - 1 + i, day)

      if (currentVenc.getMonth() !== (month - 1 + i) % 12) currentVenc.setDate(0)

      const yy = currentVenc.getFullYear()
      const mm = String(currentVenc.getMonth() + 1).padStart(2, '0')
      const dd = String(currentVenc.getDate()).padStart(2, '0')

      let desc = novaDespesa.descricao.trim()
      if (novaDespesa.tipo === 'parcelada') desc = `${desc} (${i + 1}/${qtd})`

      registros.push({
        empresa_id: empresaId,
        descricao: desc,
        valor: valorNumerico,
        data_vencimento: `${yy}-${mm}-${dd}`,
        status: i === 0 ? novaDespesa.status : 'pendente',
        grupo_id: grupoId
      })
    }

    const { error } = await supabase.from('despesas').insert(registros)

    if (error) {
      showToast(`Erro ao salvar despesa: ${error.message}`, "error")
    } else {
      setNovaDespesa({ descricao: '', valor: '', data_vencimento: new Date().toISOString().split('T')[0], status: 'pendente', tipo: 'unica', parcelas: 12 })
      showToast("Despesa(s) registrada(s) com sucesso!", "success")
      carregarCaixa()
    }
    setIsProcessando(false)
  }

  const abrirModalEditar = (despesa) => {
    setDespesaEditando({ ...despesa, data_vencimento_original: despesa.data_vencimento })
    setTipoEdicaoDespesa('unica')
    setIsModalEditOpen(true)
  }

  const handleSalvarEdicao = async (e) => {
    e.preventDefault()
    setIsProcessando(true)
    const valorNum = parseFloat(despesaEditando.valor)

    try {
      if (despesaEditando.grupo_id && tipoEdicaoDespesa === 'serie') {
        await supabase.from('despesas').update({
          descricao: despesaEditando.descricao,
          valor: valorNum,
          data_vencimento: despesaEditando.data_vencimento,
          status: despesaEditando.status
        }).eq('id', despesaEditando.id)

        await supabase.from('despesas').update({
          valor: valorNum
        }).eq('grupo_id', despesaEditando.grupo_id).gt('data_vencimento', despesaEditando.data_vencimento_original)

        showToast("Valores das próximas parcelas atualizados com sucesso!", "success")
      } else {
        await supabase.from('despesas').update({
          descricao: despesaEditando.descricao,
          valor: valorNum,
          data_vencimento: despesaEditando.data_vencimento,
          status: despesaEditando.status
        }).eq('id', despesaEditando.id)

        showToast("Despesa atualizada com sucesso!", "success")
      }
      setIsModalEditOpen(false)
      carregarCaixa()
    } catch {
      showToast("Falha ao atualizar despesa.", "error")
    } finally {
      setIsProcessando(false)
    }
  }

  const abrirModalExcluir = (despesa) => {
    setDespesaExcluindo({ ...despesa, data_vencimento_original: despesa.data_vencimento })
    setTipoRemocaoDespesa('unica')
    setIsModalDeleteOpen(true)
  }

  const confirmarExclusao = async () => {
    setIsProcessando(true)
    try {
      if (despesaExcluindo.grupo_id && tipoRemocaoDespesa === 'serie') {
        await supabase.from('despesas')
          .delete()
          .eq('grupo_id', despesaExcluindo.grupo_id)
          .gte('data_vencimento', despesaExcluindo.data_vencimento_original)
      } else {
        await supabase.from('despesas').delete().eq('id', despesaExcluindo.id)
      }
      showToast("Despesa(s) excluída(s) com sucesso!", "success")
      setIsModalDeleteOpen(false)
      carregarCaixa()
    } catch {
      showToast("Falha ao excluir despesa.", "error")
    } finally {
      setIsProcessando(false)
    }
  }

  const alterarStatusDespesa = async (id, novoStatus) => {
    setIsProcessando(true)
    const { error } = await supabase.from('despesas').update({ status: novoStatus }).eq('id', id)

    if (error) {
      showToast("Erro ao atualizar status.", "error")
    } else {
      showToast("Status atualizado!", "success")
      carregarCaixa()
    }
    setIsProcessando(false)
  }

  const faturamentoBruto = agendamentos.reduce((acc, a) => acc + Number(a.valor || 0), 0)
  const totalComissoes = agendamentos.reduce((acc, a) => acc + Number(a.valor_comissao || 0), 0)
  const despesasTotais = despesas.reduce((acc, d) => {
    const vencData = new Date(`${d.data_vencimento}T12:00:00`)
    const hoje = new Date(`${mesSelecionado}-01T12:00:00`)
    if (vencData.getMonth() === hoje.getMonth() && vencData.getFullYear() === hoje.getFullYear()) {
      return acc + Number(d.valor || 0)
    }
    return acc
  }, 0)
  const lucroLiquido = faturamentoBruto - totalComissoes - despesasTotais

  const agendamentosRepasse = agendamentos.filter(a => {
    if (periodoRepasse === 'mensal') return true;
    const dataAg = new Date(a.data_hora.replace(' ', 'T'));
    const dia = dataAg.getDate();
    if (periodoRepasse === 'quinzena1') return dia <= 15;
    if (periodoRepasse === 'quinzena2') return dia > 15;
    if (periodoRepasse === 'semana') {
      const hoje = new Date();
      const domingo = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
      domingo.setHours(0,0,0,0);
      const sabado = new Date(domingo);
      sabado.setDate(domingo.getDate() + 6);
      sabado.setHours(23,59,59,999);
      return dataAg >= domingo && dataAg <= sabado;
    }
    return true;
  });

  const comissoesPorProfissional = {}
  agendamentosRepasse.forEach(a => {
    if (!a.profissional) return
    if (!comissoesPorProfissional[a.profissional]) comissoesPorProfissional[a.profissional] = 0
    comissoesPorProfissional[a.profissional] += Number(a.valor_comissao || 0)
  })

  const arrayComissoes = Object.entries(comissoesPorProfissional).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)

  const exportarExcel = () => {
    let csv = "RELATORIO FINANCEIRO\n\n";
    csv += `Mes/Ano:,${mesSelecionado.split('-').reverse().join('/')}\n`;
    csv += `Faturamento Bruto:,R$ ${faturamentoBruto.toFixed(2).replace('.', ',')}\n`;
    csv += `Comissoes Totais:,R$ ${totalComissoes.toFixed(2).replace('.', ',')}\n`;
    csv += `Despesas do Mes:,R$ ${despesasTotais.toFixed(2).replace('.', ',')}\n`;
    csv += `Lucro Liquido:,R$ ${lucroLiquido.toFixed(2).replace('.', ',')}\n\n`;

    csv += "DESPESAS\nDescricao,Vencimento,Valor,Status\n";
    despesas.filter(d => d.data_vencimento.startsWith(mesSelecionado)).forEach(d => {
      csv += `${d.descricao},${d.data_vencimento.split('-').reverse().join('/')},R$ ${d.valor.toFixed(2).replace('.', ',')},${d.status.toUpperCase()}\n`;
    });
    csv += "\n";

    csv += `REPASSES PROFISSIONAIS (${periodoRepasse.toUpperCase()})\nProfissional,Comissao Gerada\n`;
    arrayComissoes.forEach(c => {
      csv += `${c.nome},R$ ${c.valor.toFixed(2).replace('.', ',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `relatorio_financeiro_${mesSelecionado}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);

    showToast("Relatório baixado com sucesso!", "success")
  }

  if (!empresaId) return <div className="p-6 rounded-xl bg-red-50 text-red-700 text-sm font-medium">Erro: ID não identificado.</div>

  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-600"
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"

  return (
    <div className="space-y-6 animate-fade-in">

      {/* CABEÇALHO COM FILTROS E EXPORTAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gestão Financeira</h2>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Período:</span>
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="border-none outline-none bg-transparent text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
            />
          </div>
          {loading && <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Atualizando...</span>}
        </div>
        <button
          onClick={exportarExcel}
          className="px-4 py-2 bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          Exportar CSV
        </button>
      </div>

      {/* CARDS TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Faturamento Bruto</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            R$ {faturamentoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">(-) Comissões Totais</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            R$ {totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">(-) Despesas do Mês</p>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            R$ {despesasTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className={`rounded-2xl p-5 shadow-xs border ${
          lucroLiquido >= 0
            ? 'bg-slate-900 dark:bg-blue-950 border-slate-900 dark:border-blue-800 text-white'
            : 'bg-red-950 border-red-800 text-white'
        }`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">= Lucro Líquido</p>
          <p className="mt-2 text-2xl font-bold text-white">
            R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* GRID PRINCIPAL (3 COLUNAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LANÇAR DESPESA (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
            Lançar Despesa
          </h3>
          <form onSubmit={handleSalvarDespesa} className="space-y-3.5 mt-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={novaDespesa.tipo} onChange={e => setNovaDespesa({...novaDespesa, tipo: e.target.value})}>
                  <option value="unica">Única</option>
                  <option value="fixa">Fixa Mensal</option>
                  <option value="parcelada">Parcelada</option>
                </select>
              </div>
              {novaDespesa.tipo !== 'unica' && (
                <div className="flex-1">
                  <label className={labelCls}>{novaDespesa.tipo === 'parcelada' ? 'Parcelas' : 'Meses'}</label>
                  <input type="number" min="2" max="60" required className={inputCls} value={novaDespesa.parcelas} onChange={e => setNovaDespesa({...novaDespesa, parcelas: e.target.value})} />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input type="text" required placeholder="Ex: Aluguel, Energia..." className={inputCls} value={novaDespesa.descricao} onChange={e => setNovaDespesa({...novaDespesa, descricao: e.target.value})} />
            </div>
            <div>
              <label className={labelCls}>{novaDespesa.tipo === 'parcelada' ? 'Valor da Parcela (R$)' : 'Valor (R$)'}</label>
              <input type="number" step="0.01" required placeholder="0,00" className={inputCls} value={novaDespesa.valor} onChange={e => setNovaDespesa({...novaDespesa, valor: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>{novaDespesa.tipo !== 'unica' ? '1º Vencimento' : 'Vencimento'}</label>
                <input type="date" required className={inputCls} value={novaDespesa.data_vencimento} onChange={e => setNovaDespesa({...novaDespesa, data_vencimento: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={novaDespesa.status} onChange={e => setNovaDespesa({...novaDespesa, status: e.target.value})}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Já Pago</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessando}
              className="w-full py-2.5 bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer mt-2"
            >
              {isProcessando ? 'Salvando...' : 'Adicionar Despesa'}
            </button>
          </form>
        </div>

        {/* TABELA CONTAS (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
            Contas de {mesSelecionado.split('-').reverse().join('/')}
          </h3>
          {despesas.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhuma despesa para este mês.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto mt-3">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-2">Descrição</th>
                    <th className="py-2.5 px-2">Venc.</th>
                    <th className="py-2.5 px-2">Valor</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                  {despesas.map(d => (
                    <tr key={d.id}>
                      <td className="py-3 px-2 font-medium text-slate-900 dark:text-white">{d.descricao}</td>
                      <td className="py-3 px-2 text-slate-500 dark:text-slate-400">{d.data_vencimento.split('-').reverse().join('/')}</td>
                      <td className="py-3 px-2 text-red-600 dark:text-red-400 font-semibold">R$ {d.valor}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                          d.status === 'pago'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap space-x-1">
                        {d.status === 'pendente' && (
                          <button disabled={isProcessando} onClick={() => alterarStatusDespesa(d.id, 'pago')} className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-medium cursor-pointer">
                            Pagar
                          </button>
                        )}
                        <button disabled={isProcessando} onClick={() => abrirModalEditar(d)} className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer">
                          Editar
                        </button>
                        <button disabled={isProcessando} onClick={() => abrirModalExcluir(d)} className="px-2 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-medium cursor-pointer">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* REPASSES (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Repasses</h3>
            <select
              value={periodoRepasse}
              onChange={e => setPeriodoRepasse(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="mensal">Mês Completo</option>
              <option value="quinzena1">1ª Quinzena</option>
              <option value="quinzena2">2ª Quinzena</option>
              <option value="semana">Semana Atual</option>
            </select>
          </div>
          {arrayComissoes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhuma comissão no período.
            </div>
          ) : (
            <ul className="space-y-2.5 max-h-[380px] overflow-y-auto">
              {arrayComissoes.map((prof, idx) => (
                <li key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{prof.nome}</p>
                    <span className="text-[11px] text-slate-400">Acumulado</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    R$ {prof.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL EDITAR DESPESA */}
      {isModalEditOpen && despesaEditando && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              Editar Despesa
            </h3>

            {despesaEditando.grupo_id && (
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 mb-4">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Despesa em Série</p>
                <select className={inputCls} value={tipoEdicaoDespesa} onChange={e => setTipoEdicaoDespesa(e.target.value)}>
                  <option value="unica">Editar APENAS este mês</option>
                  <option value="serie">Editar este e PRÓXIMOS meses</option>
                </select>
              </div>
            )}

            <form onSubmit={handleSalvarEdicao} className="space-y-3.5">
              <div>
                <label className={labelCls}>Descrição</label>
                <input type="text" className={inputCls} value={despesaEditando.descricao} onChange={e => setDespesaEditando({...despesaEditando, descricao: e.target.value})} required />
              </div>
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input type="number" step="0.01" className={inputCls} value={despesaEditando.valor} onChange={e => setDespesaEditando({...despesaEditando, valor: e.target.value})} required />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Vencimento</label>
                  <input type="date" className={inputCls} value={despesaEditando.data_vencimento} onChange={e => setDespesaEditando({...despesaEditando, data_vencimento: e.target.value})} required />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={despesaEditando.status} onChange={e => setDespesaEditando({...despesaEditando, status: e.target.value})}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsModalEditOpen(false)} disabled={isProcessando} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={isProcessando} className="flex-2 py-2 px-4 bg-slate-900 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR DESPESA */}
      {isModalDeleteOpen && despesaExcluindo && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Excluir Despesa?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Confirma a exclusão de <strong>{despesaExcluindo.descricao}</strong>?
            </p>

            {despesaExcluindo.grupo_id && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 mb-4 text-left">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">Despesa em Série detectada</p>
                <select className={inputCls} value={tipoRemocaoDespesa} onChange={e => setTipoRemocaoDespesa(e.target.value)}>
                  <option value="unica">Apagar APENAS este mês</option>
                  <option value="serie">Apagar este e PRÓXIMOS meses</option>
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setIsModalDeleteOpen(false)} disabled={isProcessando} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={isProcessando} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white z-50 ${
          toast.type === 'success' ? 'bg-slate-900 dark:bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
