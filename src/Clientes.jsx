import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Clientes({ empresaId }) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')

  const [toast, setToast] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modoModal, setModoModal] = useState('add')
  const [formData, setFormData] = useState({ id: null, nome: '', telefone: '' })

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (empresaId) fetchClientes()
  }, [empresaId])

  const fetchClientes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })

    if (error) {
      showToast("Erro ao carregar a lista de clientes.", "error")
    } else {
      setClientes(data || [])
    }
    setLoading(false)
  }

  const formatarTelefoneVisor = (tel) => {
    if (!tel) return '';
    let val = tel.toString().replace(/\D/g, '');
    if (val.startsWith('55') && val.length === 13) val = val.slice(2);
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 2 && val.length <= 7) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length > 7) return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
    if (val.length > 0) return `(${val}`;
    return val;
  }

  const handleTelefoneChange = (e) => {
    setFormData({ ...formData, telefone: formatarTelefoneVisor(e.target.value) });
  }

  const abrirModalAdd = () => {
    setModoModal('add');
    setFormData({ id: null, nome: '', telefone: '' });
    setIsModalOpen(true);
  }

  const abrirModalEdit = (cliente) => {
    setModoModal('edit');
    setFormData({ id: cliente.id, nome: cliente.nome || '', telefone: formatarTelefoneVisor(cliente.telefone || '') });
    setIsModalOpen(true);
  }

  const handleSalvarCliente = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    const nomeClean = formData.nome.trim();
    const telNumeros = formData.telefone.replace(/\D/g, '');

    if (!nomeClean || telNumeros.length !== 11) {
      showToast("Preencha o nome e um WhatsApp válido com DDD.", "error");
      setIsUpdating(false);
      return;
    }

    const telFinal = `55${telNumeros}`;

    if (modoModal === 'add') {
      const { data, error } = await supabase.from('clientes').insert([{ empresa_id: empresaId, nome: nomeClean, telefone: telFinal }]).select();
      if (error) showToast("Erro: Esse WhatsApp já pode estar cadastrado.", "error");
      else if (data) {
        setClientes([data[0], ...clientes]);
        showToast("Cliente adicionado com sucesso!", "success");
        setIsModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from('clientes').update({ nome: nomeClean, telefone: telFinal }).eq('id', formData.id).eq('empresa_id', empresaId).select();
      if (error) showToast("Erro ao atualizar cliente.", "error");
      else if (data) {
        setClientes(clientes.map(c => c.id === formData.id ? data[0] : c));
        showToast("Cliente atualizado com sucesso!", "success");
        setIsModalOpen(false);
      }
    }
    setIsUpdating(false);
  }

  const toggleBloqueio = async (clienteId, nome, statusAtual) => {
    const acao = statusAtual ? 'desbloquear' : 'bloquear'
    if (!window.confirm(`Tem certeza que deseja ${acao} o cliente ${nome}?`)) return

    setIsUpdating(true)
    const { error } = await supabase.from('clientes').update({ bloqueado: !statusAtual }).eq('id', clienteId).eq('empresa_id', empresaId)

    if (error) showToast(`Falha ao atualizar o status.`, "error")
    else {
      setClientes(clientes.map(c => c.id === clienteId ? { ...c, bloqueado: !statusAtual } : c))
      showToast(`Cliente ${statusAtual ? 'desbloqueado' : 'bloqueado'} com sucesso!`, "success")
    }
    setIsUpdating(false)
  }

  const clientesFiltrados = clientes.filter(cliente => {
    if (!termoBusca) return true;
    const termoClean = termoBusca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nomeClean = (cliente.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const telClean = (cliente.telefone || '');
    return nomeClean.includes(termoClean) || telClean.includes(termoClean);
  });

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Carregando base de clientes...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Base de Clientes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie contatos e permissões de agendamento via assistente.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar nome ou telefone..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-600"
              />
            </div>

            <button
              onClick={abrirModalAdd}
              className="px-4 py-2 bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              + Novo Cliente
            </button>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400 dark:text-slate-500">
            Nenhum cliente registrado ainda. Adicione manualmente ou aguarde contatos via WhatsApp.
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400 dark:text-slate-500">
            Nenhum cliente encontrado para <strong>"{termoBusca}"</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className={cliente.bloqueado ? 'bg-red-50/30 dark:bg-red-950/15' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors'}>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                      {cliente.nome || 'Desconhecido'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      +{cliente.telefone}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {cliente.criado_em ? new Date(cliente.criado_em).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {cliente.bloqueado ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => abrirModalEdit(cliente)}
                          disabled={isUpdating}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleBloqueio(cliente.id, cliente.nome, cliente.bloqueado)}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            cliente.bloqueado
                              ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-700 dark:hover:bg-blue-600'
                              : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200/70 dark:border-red-900/50'
                          }`}
                        >
                          {cliente.bloqueado ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ADICIONAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              {modoModal === 'add' ? 'Cadastrar Cliente' : 'Editar Cliente'}
            </h3>
            <form onSubmit={handleSalvarCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  disabled={isUpdating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  WhatsApp (DDD + Número)
                </label>
                <input
                  type="text"
                  required
                  placeholder="(27) 99999-9999"
                  value={formData.telefone}
                  onChange={handleTelefoneChange}
                  disabled={isUpdating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  {isUpdating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white z-50 flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-slate-900 dark:bg-emerald-600' : 'bg-red-600'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
