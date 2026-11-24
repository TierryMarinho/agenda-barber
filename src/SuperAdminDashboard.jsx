import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const supabaseAuth = supabase

const FORM_EMPRESA_VAZIO = {
  nome: '', telefone_whatsapp: '', prompt: '', plano: 'pro', ativo: true,
  hora_abertura: '08:00', hora_fechamento: '18:00', instance_name: '',
}
const FORM_ADMIN_VAZIO = { nome: '', email: '', senha: '' }

export default function SuperAdminDashboard() {
  const [empresas,     setEmpresas]     = useState([])
  const [usuarios,     setUsuarios]     = useState([])
  const [estatisticas, setEstatisticas] = useState({ totalEmpresas: 0, totalClientes: 0, totalUsuarios: 0 })
  const [loading,      setLoading]      = useState(true)
  const [isUpdating,   setIsUpdating]   = useState(false)
  const [termoBusca,   setTermoBusca]   = useState('')

  const [modalNovoCliente, setModalNovoCliente] = useState(false)
  const [formEmpresa,      setFormEmpresa]      = useState(FORM_EMPRESA_VAZIO)
  const [formAdmin,        setFormAdmin]        = useState(FORM_ADMIN_VAZIO)

  const [modalEditar,  setModalEditar]  = useState({ isOpen: false, empresa: null, adminUser: null })
  const [formEditar,   setFormEditar]   = useState({ ...FORM_EMPRESA_VAZIO, google_access_token: '' })

  const [modalVer, setModalVer] = useState({
    isOpen: false, empresa: null,
    profissionais: [], adminUser: null, usersVinculados: []
  })

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
  const [toast,        setToast]        = useState({ show: false, message: '', type: 'success' })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500)
  }
  const fecharConfirm = () => setConfirmModal({ isOpen: false, title: '', message: '', action: null })

  useEffect(() => { fetchTudo() }, [])

  const fetchTudo = async () => {
    setLoading(true)
    try {
      const [{ data: empData }, { data: usrData }, { count: countClientes }] = await Promise.all([
        supabase.from('empresas').select('*').order('criado_em', { ascending: false }),
        supabase.from('usuarios').select('*'),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
      ])
      setEmpresas(empData || [])
      setUsuarios(usrData || [])
      setEstatisticas({
        totalEmpresas: empData?.length || 0,
        totalClientes: countClientes || 0,
        totalUsuarios: usrData?.length || 0,
      })
    } catch {
      showToast('Erro ao carregar o painel.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const emailAdmin = (empresaId) => {
    const u = usuarios.find(u => u.empresa_id === empresaId && u.role === 'admin')
    return u?.email || '—'
  }

  const resetarSenha = async (email) => {
    if (!email || email === '—') return showToast('E-mail do admin não encontrado.', 'error')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) showToast('Erro ao enviar reset: ' + error.message, 'error')
    else showToast(`Link de redefinição enviado para ${email}`, 'success')
  }

  const handleCriarCliente = async (e) => {
    e.preventDefault()
    if (!formAdmin.senha || formAdmin.senha.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres.', 'error')
      return
    }
    setIsUpdating(true)
    try {
      const { data: novaEmpresa, error: errEmp } = await supabase
        .from('empresas')
        .insert([{
          nome: formEmpresa.nome, telefone_whatsapp: formEmpresa.telefone_whatsapp,
          prompt: formEmpresa.prompt, plano: formEmpresa.plano, ativo: formEmpresa.ativo,
          hora_abertura: formEmpresa.hora_abertura, hora_fechamento: formEmpresa.hora_fechamento,
          instance_name: formEmpresa.instance_name,
        }])
        .select().single()
      if (errEmp) throw new Error('Erro ao criar empresa: ' + errEmp.message)

      const { error: errUsr } = await supabase.from('usuarios').insert([{
        empresa_id: novaEmpresa.id, nome: formAdmin.nome,
        email: formAdmin.email.toLowerCase(), role: 'admin',
      }])
      if (errUsr) throw new Error('Empresa criada, mas erro no usuário: ' + errUsr.message)

      const { error: errAuth } = await supabaseAuth.auth.signUp({
        email: formAdmin.email.toLowerCase(), password: formAdmin.senha,
        options: { data: { nome: formAdmin.nome } }
      })
      if (errAuth) showToast(`Empresa criada, mas erro no login: ${errAuth.message}`, 'warning')
      else showToast('Cliente criado com sucesso!', 'success')

      await fetchTudo()
      setModalNovoCliente(false)
      setFormEmpresa(FORM_EMPRESA_VAZIO)
      setFormAdmin(FORM_ADMIN_VAZIO)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const abrirEditar = async (emp) => {
    const { data: adminUser } = await supabase
      .from('usuarios').select('id, nome, email')
      .eq('empresa_id', emp.id).eq('role', 'admin').maybeSingle()

    setFormEditar({
      nome: emp.nome || '', telefone_whatsapp: emp.telefone_whatsapp || '',
      prompt: emp.prompt || '', plano: emp.plano || 'pro', ativo: emp.ativo ?? true,
      google_access_token: emp.google_access_token || '',
      hora_abertura: emp.hora_abertura || '08:00', hora_fechamento: emp.hora_fechamento || '18:00',
      instance_name: emp.instance_name || '',
    })
    setModalEditar({ isOpen: true, empresa: emp, adminUser: adminUser || null })
  }

  const handleSalvarEdicao = async (e) => {
    e.preventDefault()
    setIsUpdating(true)
    try {
      const { error } = await supabase.from('empresas').update({
        nome: formEditar.nome, telefone_whatsapp: formEditar.telefone_whatsapp,
        prompt: formEditar.prompt, plano: formEditar.plano, ativo: formEditar.ativo,
        google_access_token: formEditar.google_access_token,
        hora_abertura: formEditar.hora_abertura, hora_fechamento: formEditar.hora_fechamento,
        instance_name: formEditar.instance_name,
      }).eq('id', modalEditar.empresa.id)

      if (error) throw error
      showToast('Empresa atualizada!', 'success')
      setModalEditar({ isOpen: false, empresa: null, adminUser: null })
      await fetchTudo()
    } catch (err) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const abrirVer = async (emp) => {
    const { data: adminUser } = await supabase
      .from('usuarios').select('id, nome, email, role')
      .eq('empresa_id', emp.id).eq('role', 'admin').maybeSingle()

    const { data: profs } = await supabase
      .from('profissionais').select('*')
      .eq('empresa_id', emp.id).order('nome')

    const profIds = (profs || []).map(p => p.id).filter(Boolean)
    let usersVinculados = []
    if (profIds.length > 0) {
      const { data: uv } = await supabase
        .from('usuarios').select('id, nome, email, role, profissional_id')
        .in('profissional_id', profIds)
      usersVinculados = uv || []
    }

    setModalVer({ isOpen: true, empresa: emp, profissionais: profs || [], adminUser: adminUser || null, usersVinculados })
  }

  const toggleStatus = (id, nome, statusAtual) => {
    setConfirmModal({
      isOpen: true,
      title: statusAtual ? 'Suspender Acesso' : 'Reativar Acesso',
      message: `Deseja ${statusAtual ? 'suspender' : 'reativar'} o acesso de "${nome}"?`,
      action: async () => {
        fecharConfirm(); setIsUpdating(true)
        const { error } = await supabase.from('empresas').update({ ativo: !statusAtual }).eq('id', id)
        if (!error) {
          setEmpresas(empresas.map(e => e.id === id ? { ...e, ativo: !statusAtual } : e))
          showToast('Status atualizado.', 'success')
        } else showToast('Erro ao atualizar.', 'error')
        setIsUpdating(false)
      }
    })
  }

  const solicitarExclusao = (id, nome) => {
    setConfirmModal({
      isOpen: true, title: 'Excluir Empresa Definitivamente',
      message: `ATENÇÃO: Isso apagará "${nome}" e todos os seus dados. Irreversível.`,
      action: async () => {
        fecharConfirm(); setIsUpdating(true)
        const { error } = await supabase.from('empresas').delete().eq('id', id)
        if (!error) { setEmpresas(empresas.filter(e => e.id !== id)); showToast('Empresa excluída.', 'success') }
        else showToast('Erro ao excluir.', 'error')
        setIsUpdating(false)
      }
    })
  }

  const empresasFiltradas = empresas.filter(emp => {
    if (!termoBusca) return true
    const t = termoBusca.toLowerCase()
    return emp.nome?.toLowerCase().includes(t) || emailAdmin(emp.id).toLowerCase().includes(t)
  })

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm font-medium">
        Carregando painel master...
      </div>
    )
  }

  const inputCls = "w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">

      {/* HEADER CLEAN */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 dark:bg-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              AB
            </div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Agenda Barber
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              SuperAdmin
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Empresas Ativas',  valor: estatisticas.totalEmpresas },
            { label: 'Clientes Globais', valor: estatisticas.totalClientes },
            { label: 'Usuários Globais', valor: estatisticas.totalUsuarios },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{c.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{c.valor}</p>
            </div>
          ))}
        </div>

        {/* TABELA */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gestão de Empresas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Controle os acessos dos seus clientes (SaaS).</p>
            </div>
            <div className="flex gap-2.5 items-center flex-wrap">
              <input
                type="text"
                placeholder="Buscar empresa ou e-mail..."
                value={termoBusca}
                onChange={e => setTermoBusca(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs w-60 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <button
                onClick={() => { setFormEmpresa(FORM_EMPRESA_VAZIO); setFormAdmin(FORM_ADMIN_VAZIO); setModalNovoCliente(true) }}
                className="px-4 py-2 bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                + Novo Cliente
              </button>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Responsável (Admin)</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {empresasFiltradas.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-slate-400">Nenhuma empresa encontrada.</td></tr>
                ) : empresasFiltradas.map(emp => (
                  <tr key={emp.id} className={!emp.ativo ? 'bg-red-50/30 dark:bg-red-950/15' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{emp.nome}</span><br />
                      <span className="text-[11px] text-slate-400 font-mono">ID: {emp.id.split('-')[0]}...</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{emailAdmin(emp.id)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold uppercase">
                        {emp.plano}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {emp.ativo ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Operante
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Suspenso
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <button onClick={() => abrirVer(emp)} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">Ver</button>
                        <button onClick={() => abrirEditar(emp)} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">Editar</button>
                        <button onClick={() => toggleStatus(emp.id, emp.nome, emp.ativo)} disabled={isUpdating} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          {emp.ativo ? 'Suspender' : 'Reativar'}
                        </button>
                        <button onClick={() => solicitarExclusao(emp.id, emp.nome)} disabled={isUpdating} className="px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium cursor-pointer">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── MODAL: NOVO CLIENTE ──────────────────────────────────────────────── */}
      {modalNovoCliente && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Novo Cliente</h3>
            <form onSubmit={handleCriarCliente} className="space-y-4">
              <Secao titulo="Dados da Empresa">
                <Campo label="Nome Fantasia *"><input required className={inputCls} value={formEmpresa.nome} onChange={e => setFormEmpresa({...formEmpresa, nome: e.target.value})} /></Campo>
                <Campo label="Telefone WhatsApp (com DDI, ex: 5527...)"><input className={inputCls} placeholder="5527999999999" value={formEmpresa.telefone_whatsapp} onChange={e => setFormEmpresa({...formEmpresa, telefone_whatsapp: e.target.value})} /></Campo>
                <Campo label="Plano">
                  <select className={inputCls} value={formEmpresa.plano} onChange={e => setFormEmpresa({...formEmpresa, plano: e.target.value})}>
                    <option value="starter">Starter</option><option value="pro">Pro</option><option value="premium">Premium</option>
                  </select>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Horário de Abertura"><input type="time" className={inputCls} value={formEmpresa.hora_abertura} onChange={e => setFormEmpresa({...formEmpresa, hora_abertura: e.target.value})} /></Campo>
                  <Campo label="Horário de Fechamento"><input type="time" className={inputCls} value={formEmpresa.hora_fechamento} onChange={e => setFormEmpresa({...formEmpresa, hora_fechamento: e.target.value})} /></Campo>
                </div>
                <Campo label="Instance Name (WhatsApp)"><input className={inputCls} placeholder="wa_empresa_..." value={formEmpresa.instance_name} onChange={e => setFormEmpresa({...formEmpresa, instance_name: e.target.value})} /></Campo>
              </Secao>
              <Secao titulo="Prompt da IA">
                <Campo label="Instrução do Assistente Virtual">
                  <textarea rows={4} className={inputCls} placeholder="Descreva como o assistente deve se comportar..." value={formEmpresa.prompt} onChange={e => setFormEmpresa({...formEmpresa, prompt: e.target.value})} />
                </Campo>
              </Secao>
              <Secao titulo="Acesso Admin (Responsável)">
                <Campo label="Nome do Responsável *"><input required className={inputCls} value={formAdmin.nome} onChange={e => setFormAdmin({...formAdmin, nome: e.target.value})} /></Campo>
                <Campo label="E-mail de Login *"><input required type="email" className={inputCls} value={formAdmin.email} onChange={e => setFormAdmin({...formAdmin, email: e.target.value})} /></Campo>
                <Campo label="Senha Padrão * (mín. 6 caracteres)"><input required type="password" className={inputCls} value={formAdmin.senha} onChange={e => setFormAdmin({...formAdmin, senha: e.target.value})} /></Campo>
              </Secao>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalNovoCliente(false)} disabled={isUpdating} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer">{isUpdating ? 'Criando...' : 'Criar Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR EMPRESA ────────────────────────────────────────────── */}
      {modalEditar.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Editar: {modalEditar.empresa?.nome}</h3>

            <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">E-mail Admin</p>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{modalEditar.adminUser?.email || '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => resetarSenha(modalEditar.adminUser?.email)}
                className="px-3 py-1.5 bg-slate-900 dark:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Resetar Senha
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <Secao titulo="Dados da Empresa">
                <Campo label="Nome Fantasia *"><input required className={inputCls} value={formEditar.nome} onChange={e => setFormEditar({...formEditar, nome: e.target.value})} /></Campo>
                <Campo label="Telefone WhatsApp"><input className={inputCls} value={formEditar.telefone_whatsapp} onChange={e => setFormEditar({...formEditar, telefone_whatsapp: e.target.value})} /></Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Plano">
                    <select className={inputCls} value={formEditar.plano} onChange={e => setFormEditar({...formEditar, plano: e.target.value})}>
                      <option value="starter">Starter</option><option value="pro">Pro</option><option value="premium">Premium</option>
                    </select>
                  </Campo>
                  <Campo label="Status">
                    <select className={inputCls} value={formEditar.ativo ? 'true' : 'false'} onChange={e => setFormEditar({...formEditar, ativo: e.target.value === 'true'})}>
                      <option value="true">Ativo</option><option value="false">Suspenso</option>
                    </select>
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Horário de Abertura"><input type="time" className={inputCls} value={formEditar.hora_abertura} onChange={e => setFormEditar({...formEditar, hora_abertura: e.target.value})} /></Campo>
                  <Campo label="Horário de Fechamento"><input type="time" className={inputCls} value={formEditar.hora_fechamento} onChange={e => setFormEditar({...formEditar, hora_fechamento: e.target.value})} /></Campo>
                </div>
                <Campo label="Instance Name"><input className={inputCls} value={formEditar.instance_name} onChange={e => setFormEditar({...formEditar, instance_name: e.target.value})} /></Campo>
                <Campo label="Google Access Token">
                  <textarea rows={2} className={inputCls} value={formEditar.google_access_token} onChange={e => setFormEditar({...formEditar, google_access_token: e.target.value})} />
                </Campo>
              </Secao>
              <Secao titulo="Prompt da IA">
                <Campo label="Instrução do Assistente Virtual">
                  <textarea rows={5} className={inputCls} value={formEditar.prompt} onChange={e => setFormEditar({...formEditar, prompt: e.target.value})} />
                </Campo>
              </Secao>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalEditar({ isOpen: false, empresa: null, adminUser: null })} disabled={isUpdating} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer">{isUpdating ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VER EMPRESA ──────────────────────────────────────────────── */}
      {modalVer.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{modalVer.empresa?.nome}</h3>
              <button onClick={() => setModalVer({ isOpen: false, empresa: null, profissionais: [], adminUser: null, usersVinculados: [] })} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{modalVer.adminUser?.nome || '—'}</p>
                <p className="text-xs text-slate-500">{modalVer.adminUser?.email || '—'}</p>
              </div>
              <button onClick={() => resetarSenha(modalVer.adminUser?.email)} className="px-3 py-1.5 bg-slate-900 dark:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer">
                Resetar Senha
              </button>
            </div>

            <div className="space-y-4">
              <Secao titulo="Dados da Empresa">
                <CampoInfo label="ID" valor={modalVer.empresa?.id} mono />
                <CampoInfo label="Nome" valor={modalVer.empresa?.nome} />
                <CampoInfo label="Telefone WhatsApp" valor={modalVer.empresa?.telefone_whatsapp} />
                <CampoInfo label="Plano" valor={modalVer.empresa?.plano?.toUpperCase()} />
                <CampoInfo label="Status" valor={modalVer.empresa?.ativo ? 'Ativo' : 'Suspenso'} />
                <CampoInfo label="Horário" valor={`${modalVer.empresa?.hora_abertura || '—'} às ${modalVer.empresa?.hora_fechamento || '—'}`} />
                <CampoInfo label="Instance Name" valor={modalVer.empresa?.instance_name || '—'} mono />
                <CampoInfo label="Google Calendar" valor={modalVer.empresa?.google_access_token ? 'Conectado' : 'Desconectado'} />
              </Secao>

              {modalVer.empresa?.prompt && (
                <Secao titulo="Prompt da IA">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-44 overflow-y-auto">
                    {modalVer.empresa.prompt}
                  </div>
                </Secao>
              )}

              <Secao titulo={`Profissionais (${modalVer.profissionais.length})`}>
                {modalVer.profissionais.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum profissional cadastrado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {modalVer.profissionais.map(p => {
                      const userVinculado = modalVer.usersVinculados.find(u => u.profissional_id === p.id)
                      return (
                        <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white text-xs">{p.nome}</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-[11px] font-semibold">
                              {p.percentual_comissao}% comissão
                            </span>
                          </div>
                          {userVinculado ? (
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-xs text-slate-500">{userVinculado.email}</span>
                              <button onClick={() => resetarSenha(userVinculado.email)} className="text-xs font-semibold text-blue-600 cursor-pointer">
                                Resetar Senha
                              </button>
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-600 mt-1">Sem login vinculado</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Secao>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setModalVer({ isOpen: false, empresa: null, profissionais: [], adminUser: null, usersVinculados: [] })} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={fecharConfirm} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">Cancelar</button>
              <button onClick={() => { const a = confirmModal.action; fecharConfirm(); a && a() }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white ${
          toast.type === 'success' ? 'bg-slate-900 dark:bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

const Secao = ({ titulo, children }) => (
  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{titulo}</p>
    <div className="space-y-3">{children}</div>
  </div>
)

const Campo = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</label>
    {children}
  </div>
)

const CampoInfo = ({ label, valor, mono = false }) => (
  <div className="flex justify-between items-start gap-4 py-2 px-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
    <span className="text-[11px] font-semibold uppercase text-slate-400 shrink-0">{label}</span>
    <span className={`text-xs font-medium text-slate-900 dark:text-white text-right break-all ${mono ? 'font-mono' : ''}`}>{valor || '—'}</span>
  </div>
)
