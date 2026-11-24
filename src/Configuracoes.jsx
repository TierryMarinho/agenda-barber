import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Configuracoes({ empresa }) {
  const [secaoAtiva, setSecaoAtiva] = useState('estabelecimento')

  const [horaAbertura, setHoraAbertura] = useState('')
  const [horaFechamento, setHoraFechamento] = useState('')

  const [profissionaisList, setProfissionaisList] = useState([])
  const [novoProfNome, setNovoProfNome] = useState('')
  const [novoProfComissao, setNovoProfComissao] = useState('')
  const [novoProfCalendarId, setNovoProfCalendarId] = useState('')
  const [editProfModal, setEditProfModal] = useState({ isOpen: false, id: null, nome: '', comissao: '', calendar_id: '' })

  const [servicos, setServicos] = useState({})
  const [duracoes, setDuracoes] = useState({})
  const [novoServicoNome, setNovoServicoNome] = useState('')
  const [novoServicoPreco, setNovoServicoPreco] = useState('')
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('30')
  const [editServicoModal, setEditServicoModal] = useState({ isOpen: false, oldNome: '', novoNome: '', preco: '', duracao: '' })

  const [limiteAgendamento, setLimiteAgendamento] = useState(false)
  const [travaCancelamento, setTravaCancelamento] = useState(false)

  const [novaSenha, setNovaSenha] = useState('')
  const [isUpdatingSenha, setIsUpdatingSenha] = useState(false)

  const [usuariosList, setUsuariosList] = useState([])
  const [novoUsuarioNome, setNovoUsuarioNome] = useState('')
  const [novoUsuarioEmail, setNovoUsuarioEmail] = useState('')
  const [novoUsuarioRole, setNovoUsuarioRole] = useState('basico')
  const [novoUsuarioProfId, setNovoUsuarioProfId] = useState('')
  const [editUsuarioModal, setEditUsuarioModal] = useState({ isOpen: false, id: null, nome: '', role: 'basico', profissional_id: '' })
  const [isUpdatingUsuarios, setIsUpdatingUsuarios] = useState(false)

  const [isUpdating, setIsUpdating] = useState(false)
  const [isUpdatingRegras, setIsUpdatingRegras] = useState(false)
  const [isUpdatingHorarios, setIsUpdatingHorarios] = useState(false)

  const [hasGoogleToken, setHasGoogleToken] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null,
    confirmLabel: 'Confirmar',
  })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' })
    }, 3000)
  }

  const pedirConfirmacao = (titulo, mensagem, acao, label = 'Confirmar') => {
    setConfirmModal({ isOpen: true, title: titulo, message: mensagem, action: acao, confirmLabel: label })
  }

  const fecharConfirmModal = () => {
    setConfirmModal({ isOpen: false, title: '', message: '', action: null, confirmLabel: 'Confirmar' })
  }

  useEffect(() => {
    if (empresa?.id) {
      setHoraAbertura(empresa.hora_abertura || '')
      setHoraFechamento(empresa.hora_fechamento || '')
      setServicos(empresa.precos_servicos || {})
      setDuracoes(empresa.duracao_servicos || {})
      setLimiteAgendamento(empresa.limite_um_agendamento === true)
      setTravaCancelamento(empresa.trava_cancelamento_semana === true)

      fetchProfissionais()
      fetchUsuarios()
      checkGoogleToken()
    }
  }, [empresa])

  const checkGoogleToken = async () => {
    const { data } = await supabase.from('empresas').select('google_access_token').eq('id', empresa.id).single()
    setHasGoogleToken(!!(data && data.google_access_token))
  }

  const fetchProfissionais = async () => {
    const { data, error } = await supabase
      .from('profissionais')
      .select('id, nome, percentual_comissao, google_calendar_id')
      .eq('empresa_id', empresa.id)
      .order('nome')

    if (!error && data) setProfissionaisList(data)
  }

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, role, profissional_id')
      .eq('empresa_id', empresa.id)
      .order('criado_em', { ascending: false })

    if (!error && data) setUsuariosList(data)
  }

  const salvarHorarios = async () => {
    if (!horaAbertura || !horaFechamento) return showToast("Preencha abertura e fechamento.", "error")
    setIsUpdatingHorarios(true)

    try {
      const { error } = await supabase.from('empresas').update({ hora_abertura: horaAbertura, hora_fechamento: horaFechamento }).eq('id', empresa.id)
      if (error) throw error

      empresa.hora_abertura = horaAbertura
      empresa.hora_fechamento = horaFechamento
      sessionStorage.removeItem('soultech_empresa_cache')
      showToast("Horários salvos com sucesso!", "success")
    } catch {
      showToast("Erro ao salvar horários.", "error")
    } finally {
      setIsUpdatingHorarios(false)
    }
  }

  const salvarRegrasAgendamento = async () => {
    setIsUpdatingRegras(true)

    try {
      const { error } = await supabase.from('empresas').update({ limite_um_agendamento: limiteAgendamento, trava_cancelamento_semana: travaCancelamento }).eq('id', empresa.id)
      if (error) throw error

      empresa.limite_um_agendamento = limiteAgendamento
      empresa.trava_cancelamento_semana = travaCancelamento
      sessionStorage.removeItem('soultech_empresa_cache')
      showToast("Travas de segurança salvas!", "success")
    } catch {
      showToast("Erro ao salvar as travas de segurança.", "error")
    } finally {
      setIsUpdatingRegras(false)
    }
  }

  const adicionarProfissionalDB = async () => {
    const nomeFormatado = novoProfNome.trim()
    const valorComissao = parseInt(novoProfComissao)

    if (!nomeFormatado) return showToast("Preencha o nome do profissional.", "error")
    if (isNaN(valorComissao) || valorComissao < 0 || valorComissao > 100) return showToast("Comissão inválida.", "error")
    if (profissionaisList.some(p => p.nome.toLowerCase() === nomeFormatado.toLowerCase())) return showToast("Profissional já existe.", "error")

    setIsUpdating(true)
    try {
      const { data, error } = await supabase.from('profissionais').insert([{
        empresa_id: empresa.id,
        nome: nomeFormatado,
        percentual_comissao: valorComissao,
        google_calendar_id: novoProfCalendarId.trim() || null
      }]).select()

      if (error) throw error
      if (data) {
        setProfissionaisList([...profissionaisList, data[0]])
        setNovoProfNome('')
        setNovoProfComissao('')
        setNovoProfCalendarId('')
        showToast("Profissional adicionado!", "success")
      }
    } catch {
      showToast("Falha ao salvar profissional.", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  const salvarEdicaoProfissional = async (e) => {
    e.preventDefault()
    setIsUpdating(true)
    const nomeFormatado = editProfModal.nome.trim()
    const valorComissao = parseInt(editProfModal.comissao)

    if (!nomeFormatado || isNaN(valorComissao) || valorComissao < 0 || valorComissao > 100) {
      showToast("Dados inválidos.", "error")
      setIsUpdating(false)
      return
    }

    try {
      const { error } = await supabase.from('profissionais').update({
        nome: nomeFormatado,
        percentual_comissao: valorComissao,
        google_calendar_id: editProfModal.calendar_id.trim() || null
      }).eq('id', editProfModal.id).eq('empresa_id', empresa.id)

      if (error) throw error

      setProfissionaisList(profissionaisList.map(p => p.id === editProfModal.id ? {
        ...p, nome: nomeFormatado, percentual_comissao: valorComissao, google_calendar_id: editProfModal.calendar_id.trim() || null
      } : p))
      showToast("Profissional atualizado!", "success")
      setEditProfModal({ isOpen: false, id: null, nome: '', comissao: '', calendar_id: '' })
    } catch {
      showToast("Erro ao atualizar.", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  const solicitarRemocaoProfissional = (id, nome) => {
    pedirConfirmacao(
      'Remover Profissional',
      `Tem certeza que deseja remover ${nome} da equipe?`,
      async () => {
        fecharConfirmModal()
        setIsUpdating(true)
        try {
          const { error } = await supabase.from('profissionais').delete().eq('id', id).eq('empresa_id', empresa.id)
          if (error) throw error
          setProfissionaisList(profissionaisList.filter(p => p.id !== id))
          showToast("Profissional removido.", "success")
        } catch {
          showToast("Erro ao remover profissional.", "error")
        } finally {
          setIsUpdating(false)
        }
      },
      'Confirmar Exclusão'
    )
  }

  const adicionarServico = async () => {
    const nome = novoServicoNome.trim()
    const preco = parseFloat(novoServicoPreco)
    const duracao = parseInt(novoServicoDuracao)

    if (!nome || isNaN(preco) || isNaN(duracao) || duracao <= 0) return showToast("Preencha o nome, preço e duração.", "error")
    if (Object.keys(servicos).some(k => k.toLowerCase() === nome.toLowerCase())) return showToast('Este serviço já está cadastrado.', "error")

    setIsUpdating(true)
    const novoCatalogoPrecos = { ...servicos, [nome]: preco }
    const novoCatalogoDuracoes = { ...duracoes, [nome]: duracao }

    try {
      const { error } = await supabase.from('empresas').update({ precos_servicos: novoCatalogoPrecos, duracao_servicos: novoCatalogoDuracoes }).eq('id', empresa.id)
      if (error) throw error

      setServicos(novoCatalogoPrecos)
      setDuracoes(novoCatalogoDuracoes)
      setNovoServicoNome('')
      setNovoServicoPreco('')
      setNovoServicoDuracao('30')

      empresa.precos_servicos = novoCatalogoPrecos
      empresa.duracao_servicos = novoCatalogoDuracoes
      sessionStorage.removeItem('soultech_empresa_cache')
      showToast("Serviço adicionado!", "success")
    } catch {
      showToast("Erro ao salvar o serviço.", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  const salvarEdicaoServico = async (e) => {
    e.preventDefault()
    setIsUpdating(true)

    const novoNomeFormatado = editServicoModal.novoNome.trim()
    const preco = parseFloat(editServicoModal.preco)
    const duracao = parseInt(editServicoModal.duracao)

    if (!novoNomeFormatado || isNaN(preco) || isNaN(duracao) || duracao <= 0) {
      showToast("Dados inválidos.", "error")
      setIsUpdating(false)
      return
    }

    if (novoNomeFormatado.toLowerCase() !== editServicoModal.oldNome.toLowerCase() &&
        Object.keys(servicos).some(k => k.toLowerCase() === novoNomeFormatado.toLowerCase())) {
      showToast("Já existe um serviço com esse nome.", "error")
      setIsUpdating(false)
      return
    }

    const novoCatalogoPrecos = { ...servicos }
    const novoCatalogoDuracoes = { ...duracoes }

    if (novoNomeFormatado !== editServicoModal.oldNome) {
      delete novoCatalogoPrecos[editServicoModal.oldNome]
      delete novoCatalogoDuracoes[editServicoModal.oldNome]
    }

    novoCatalogoPrecos[novoNomeFormatado] = preco
    novoCatalogoDuracoes[novoNomeFormatado] = duracao

    try {
      const { error } = await supabase.from('empresas').update({ precos_servicos: novoCatalogoPrecos, duracao_servicos: novoCatalogoDuracoes }).eq('id', empresa.id)
      if (error) throw error

      setServicos(novoCatalogoPrecos)
      setDuracoes(novoCatalogoDuracoes)
      empresa.precos_servicos = novoCatalogoPrecos
      empresa.duracao_servicos = novoCatalogoDuracoes
      sessionStorage.removeItem('soultech_empresa_cache')
      showToast("Serviço atualizado!", "success")
      setEditServicoModal({ isOpen: false, oldNome: '', novoNome: '', preco: '', duracao: '' })
    } catch {
      showToast("Erro ao atualizar serviço.", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  const solicitarRemocaoServico = (nomeParaRemover) => {
    pedirConfirmacao(
      'Remover Serviço',
      `Tem certeza que deseja remover "${nomeParaRemover}" do catálogo?`,
      async () => {
        fecharConfirmModal()
        setIsUpdating(true)

        const novoCatalogoPrecos = { ...servicos }
        const novoCatalogoDuracoes = { ...duracoes }
        delete novoCatalogoPrecos[nomeParaRemover]
        delete novoCatalogoDuracoes[nomeParaRemover]

        try {
          const { error } = await supabase.from('empresas').update({ precos_servicos: novoCatalogoPrecos, duracao_servicos: novoCatalogoDuracoes }).eq('id', empresa.id)
          if (error) throw error

          setServicos(novoCatalogoPrecos)
          setDuracoes(novoCatalogoDuracoes)
          empresa.precos_servicos = novoCatalogoPrecos
          empresa.duracao_servicos = novoCatalogoDuracoes
          sessionStorage.removeItem('soultech_empresa_cache')
          showToast("Serviço removido.", "success")
        } catch {
          showToast("Erro ao remover serviço.", "error")
        } finally {
          setIsUpdating(false)
        }
      },
      'Confirmar Exclusão'
    )
  }

  const adicionarUsuarioDB = async () => {
    const nomeFormatado = novoUsuarioNome.trim()
    const emailFormatado = novoUsuarioEmail.trim().toLowerCase()

    if (!nomeFormatado || !emailFormatado) return showToast("Preencha o nome e e-mail.", "error")
    if (usuariosList.some(u => u.email === emailFormatado)) return showToast("Este e-mail já está cadastrado.", "error")

    setIsUpdatingUsuarios(true)
    try {
      const payload = {
        empresa_id: empresa.id,
        nome: nomeFormatado,
        email: emailFormatado,
        role: novoUsuarioRole,
        profissional_id: novoUsuarioProfId || null
      }

      const { data, error } = await supabase.from('usuarios').insert([payload]).select()
      if (error) throw error

      if (data) {
        setUsuariosList([data[0], ...usuariosList])
        setNovoUsuarioNome('')
        setNovoUsuarioEmail('')
        setNovoUsuarioRole('basico')
        setNovoUsuarioProfId('')
        showToast("Usuário criado com sucesso!", "success")
      }
    } catch {
      showToast("Erro ao criar usuário.", "error")
    } finally {
      setIsUpdatingUsuarios(false)
    }
  }

  const salvarEdicaoUsuario = async (e) => {
    e.preventDefault()
    setIsUpdatingUsuarios(true)

    const nomeFormatado = editUsuarioModal.nome.trim()
    if (!nomeFormatado) {
      showToast("O nome é obrigatório.", "error")
      setIsUpdatingUsuarios(false)
      return
    }

    try {
      const payload = {
        nome: nomeFormatado,
        role: editUsuarioModal.role,
        profissional_id: editUsuarioModal.profissional_id || null
      }

      const { error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', editUsuarioModal.id)
        .eq('empresa_id', empresa.id)

      if (error) throw error

      setUsuariosList(usuariosList.map(u => u.id === editUsuarioModal.id ? { ...u, ...payload } : u))
      showToast("Usuário atualizado!", "success")
      setEditUsuarioModal({ isOpen: false, id: null, nome: '', role: 'basico', profissional_id: '' })
    } catch {
      showToast("Erro ao atualizar usuário.", "error")
    } finally {
      setIsUpdatingUsuarios(false)
    }
  }

  const solicitarRemocaoUsuario = (id, nome) => {
    pedirConfirmacao(
      'Remover Usuário',
      `Tem certeza que deseja remover o acesso de "${nome}"?`,
      async () => {
        fecharConfirmModal()
        setIsUpdatingUsuarios(true)
        try {
          const { error } = await supabase.from('usuarios').delete().eq('id', id).eq('empresa_id', empresa.id)
          if (error) throw error
          setUsuariosList(usuariosList.filter(u => u.id !== id))
          showToast("Usuário removido.", "success")
        } catch {
          showToast("Erro ao remover usuário.", "error")
        } finally {
          setIsUpdatingUsuarios(false)
        }
      },
      'Remover Acesso'
    )
  }

  const atualizarSenha = async () => {
    if (!novaSenha || novaSenha.length < 6) return showToast("A nova senha deve ter pelo menos 6 caracteres.", "error")

    setIsUpdatingSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error

      showToast("Senha atualizada com sucesso!", "success")
      setNovaSenha('')
    } catch {
      showToast("Erro ao atualizar a senha.", "error")
    } finally {
      setIsUpdatingSenha(false)
    }
  }

  const revogarGoogle = async () => {
    pedirConfirmacao(
      'Revogar Integração',
      'Isso irá desconectar o Google Calendar da sua empresa. Deseja continuar?',
      async () => {
        fecharConfirmModal()
        setIsUpdating(true)
        try {
          const { error } = await supabase.from('empresas').update({
            google_access_token: null,
            google_refresh_token: null,
            google_token_expiry: null
          }).eq('id', empresa.id)

          if (error) throw error
          setHasGoogleToken(false)
          showToast('Acesso ao Google revogado.', 'success')
        } catch {
          showToast('Erro ao revogar acesso.', 'error')
        } finally {
          setIsUpdating(false)
        }
      },
      'Sim, Desconectar'
    )
  }

  const todosOsServicos = Array.from(new Set([...Object.keys(servicos), ...Object.keys(duracoes)])).sort()

  const getNomeProfissional = (id) => {
    const prof = profissionaisList.find(p => p.id === id)
    return prof ? prof.nome : 'Nenhum'
  }

  if (!empresa) return null

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-600"
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5"
  const cardCls = "bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs"

  const subTabs = [
    {
      id: 'estabelecimento',
      label: 'Estabelecimento & Regras',
      desc: 'Expediente e travas de segurança',
      badge: `${horaAbertura || '08:00'}–${horaFechamento || '19:00'}`
    },
    {
      id: 'catalogo',
      label: 'Equipe & Catálogo',
      desc: 'Profissionais, comissões e serviços',
      badge: `${profissionaisList.length} profs • ${todosOsServicos.length} serv.`
    },
    {
      id: 'usuarios',
      label: 'Acessos & Permissões',
      desc: 'Logins para recepção e equipe',
      badge: `${usuariosList.length} contas`
    },
    {
      id: 'integracoes',
      label: 'Integrações & Segurança',
      desc: 'Google Calendar e credenciais',
      badge: hasGoogleToken ? 'Google Ativo' : 'Padrão'
    }
  ]

  return (
    <div className="space-y-6 pb-12 animate-fade-in">

      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white ${
          toast.type === 'success' ? 'bg-zinc-900 dark:bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* NAVEGAÇÃO INTERNA DE CONFIGURAÇÕES (ESTILO SEGMENTADO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {subTabs.map(tab => {
          const active = secaoAtiva === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSecaoAtiva(tab.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-[#09090b] dark:bg-blue-950/70 border-zinc-900 dark:border-blue-700 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold tracking-tight">{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  {tab.badge}
                </span>
              </div>
              <p className={`text-[11px] truncate ${active ? 'text-zinc-400 dark:text-blue-200/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {tab.desc}
              </p>
            </button>
          )
        })}
      </div>

      {/* ─── ABA 1: ESTABELECIMENTO & REGRAS ─────────────────────────────── */}
      {secaoAtiva === 'estabelecimento' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Dados Gerais */}
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Identidade da Empresa
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500">Nome Fantasia</span>
                <span className="font-bold text-zinc-900 dark:text-white">{empresa.nome}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500">Plano contratado</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase text-[11px]">
                  {empresa.plano}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-zinc-500 block mb-1.5">Chave Identificadora (Tenant ID)</span>
                <code className="block p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all">
                  {empresa.id}
                </code>
              </div>
            </div>
          </div>

          {/* Horário de Expediente */}
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Janela de Expediente
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Define o intervalo padrão em que o assistente virtual agenda horários.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Abertura</label>
                  <input type="time" value={horaAbertura} onChange={(e) => setHoraAbertura(e.target.value)} disabled={isUpdatingHorarios} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fechamento</label>
                  <input type="time" value={horaFechamento} onChange={(e) => setHoraFechamento(e.target.value)} disabled={isUpdatingHorarios} className={inputCls} />
                </div>
              </div>
              <button
                onClick={() => pedirConfirmacao('Salvar Horários', `Confirma a alteração do horário para ${horaAbertura} – ${horaFechamento}?`, salvarHorarios, 'Salvar')}
                disabled={isUpdatingHorarios}
                className="w-full py-2.5 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {isUpdatingHorarios ? 'Salvando...' : 'Atualizar Expediente'}
              </button>
            </div>
          </div>

          {/* Travas de Segurança */}
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Políticas Anti-Furo (IA)
            </h3>
            <div className="space-y-3 mb-5">
              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white block">Limite de 1 Agendamento Ativo</span>
                  <span className="text-[11px] text-zinc-500">Evita que o mesmo cliente reserve múltiplos horários simultâneos.</span>
                </div>
                <input type="checkbox" checked={limiteAgendamento} onChange={(e) => setLimiteAgendamento(e.target.checked)} disabled={isUpdatingRegras} className="w-4 h-4 mt-0.5 accent-zinc-900 dark:accent-blue-600 rounded shrink-0" />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white block">Trava de Cancelamento Semanal</span>
                  <span className="text-[11px] text-zinc-500">Restringe reagendamentos seguidos na mesma semana pelo WhatsApp.</span>
                </div>
                <input type="checkbox" checked={travaCancelamento} onChange={(e) => setTravaCancelamento(e.target.checked)} disabled={isUpdatingRegras} className="w-4 h-4 mt-0.5 accent-zinc-900 dark:accent-blue-600 rounded shrink-0" />
              </label>
            </div>
            <button
              onClick={() => pedirConfirmacao('Salvar Travas', 'Confirma as alterações nas regras de agendamento?', salvarRegrasAgendamento, 'Salvar')}
              disabled={isUpdatingRegras}
              className="w-full py-2.5 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isUpdatingRegras ? 'Salvando...' : 'Aplicar Políticas'}
            </button>
          </div>
        </div>
      )}

      {/* ─── ABA 2: EQUIPE & CATÁLOGO DE SERVIÇOS ────────────────────────── */}
      {secaoAtiva === 'catalogo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Equipe */}
          <div className={cardCls}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Profissionais & Comissões</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure o percentual de repasse individual</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {profissionaisList.length} ativos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 mb-5 p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800">
              <input type="text" value={novoProfNome} onChange={(e) => setNovoProfNome(e.target.value)} placeholder="Nome do Profissional" disabled={isUpdating} className={`${inputCls} sm:col-span-4 bg-white`} />
              <input type="number" value={novoProfComissao} onChange={(e) => setNovoProfComissao(e.target.value)} placeholder="Comissão %" disabled={isUpdating} className={`${inputCls} sm:col-span-3 bg-white`} />
              <input type="text" value={novoProfCalendarId} onChange={(e) => setNovoProfCalendarId(e.target.value)} placeholder="ID Agenda Google (Opc.)" disabled={isUpdating} className={`${inputCls} sm:col-span-3 bg-white`} />
              <button
                onClick={() => pedirConfirmacao('Adicionar Profissional', `Adicionar "${novoProfNome.trim()}" com ${novoProfComissao}% de comissão?`, adicionarProfissionalDB, 'Adicionar')}
                disabled={isUpdating || !novoProfNome.trim() || !novoProfComissao}
                className="sm:col-span-2 py-2 px-3 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                + Criar
              </button>
            </div>

            {profissionaisList.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">Nenhum profissional cadastrado.</div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {profissionaisList.map((prof) => (
                  <li key={prof.id} className="py-3.5 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-blue-950 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {prof.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{prof.nome}</p>
                        <p className="text-[11px] text-zinc-400 font-mono truncate">
                          {prof.google_calendar_id || 'Agenda Principal'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                        {prof.percentual_comissao}% repasse
                      </span>
                      <button onClick={() => setEditProfModal({ isOpen: true, id: prof.id, nome: prof.nome, comissao: prof.percentual_comissao, calendar_id: prof.google_calendar_id || '' })} disabled={isUpdating} className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                        Editar
                      </button>
                      <button onClick={() => solicitarRemocaoProfissional(prof.id, prof.nome)} disabled={isUpdating} className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Catálogo de Serviços */}
          <div className={cardCls}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Catálogo de Serviços</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Valores e tempos estimados usados pela IA</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {todosOsServicos.length} itens
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 mb-5 p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800">
              <input type="text" value={novoServicoNome} onChange={(e) => setNovoServicoNome(e.target.value)} placeholder="Nome do serviço" disabled={isUpdating} className={`${inputCls} sm:col-span-5 bg-white`} />
              <input type="number" value={novoServicoPreco} onChange={(e) => setNovoServicoPreco(e.target.value)} placeholder="Preço R$" disabled={isUpdating} className={`${inputCls} sm:col-span-3 bg-white`} />
              <input type="number" value={novoServicoDuracao} onChange={(e) => setNovoServicoDuracao(e.target.value)} placeholder="Min" disabled={isUpdating} className={`${inputCls} sm:col-span-2 bg-white`} />
              <button
                onClick={() => pedirConfirmacao('Adicionar Serviço', `Adicionar "${novoServicoNome}" por R$ ${novoServicoPreco}?`, adicionarServico, 'Adicionar')}
                disabled={isUpdating || !novoServicoNome.trim() || !novoServicoPreco || !novoServicoDuracao}
                className="sm:col-span-2 py-2 px-3 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                + Criar
              </button>
            </div>

            {todosOsServicos.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">Nenhum serviço cadastrado.</div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70 max-h-96 overflow-y-auto pr-1">
                {todosOsServicos.map((nomeServico) => {
                  const preco = servicos[nomeServico] || 0
                  const duracao = duracoes[nomeServico] || 30
                  return (
                    <li key={nomeServico} className="py-3.5 flex justify-between items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white block">{nomeServico}</span>
                        <span className="text-[11px] text-zinc-400">Duração padrão: {duracao} minutos</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          R$ {Number(preco).toFixed(2)}
                        </span>
                        <button onClick={() => setEditServicoModal({ isOpen: true, oldNome: nomeServico, novoNome: nomeServico, preco: preco, duracao: duracao })} disabled={isUpdating} className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                          Editar
                        </button>
                        <button onClick={() => solicitarRemocaoServico(nomeServico)} disabled={isUpdating} className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
                          Remover
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA 3: USUÁRIOS E PERMISSÕES ────────────────────────────────── */}
      {secaoAtiva === 'usuarios' && (
        <div className={`${cardCls} animate-fade-in`}>
          <div className="pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Controle de Acessos da Equipe</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Crie credenciais individuais. Perfis "Básico" enxergam somente os horários do profissional vinculado.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6 p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 items-end">
            <div className="sm:col-span-3">
              <label className={labelCls}>Nome do Usuário</label>
              <input type="text" value={novoUsuarioNome} onChange={(e) => setNovoUsuarioNome(e.target.value)} placeholder="Ex: João Silva" disabled={isUpdatingUsuarios} className={inputCls} />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>E-mail (Login)</label>
              <input type="email" value={novoUsuarioEmail} onChange={(e) => setNovoUsuarioEmail(e.target.value)} placeholder="joao@email.com" disabled={isUpdatingUsuarios} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Nível de Permissão</label>
              <select value={novoUsuarioRole} onChange={(e) => setNovoUsuarioRole(e.target.value)} disabled={isUpdatingUsuarios} className={inputCls}>
                <option value="basico">Profissional (Básico)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Profissional Vinculado</label>
              <select value={novoUsuarioProfId} onChange={(e) => setNovoUsuarioProfId(e.target.value)} disabled={isUpdatingUsuarios} className={inputCls}>
                <option value="">(Nenhum)</option>
                {profissionaisList.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={() => pedirConfirmacao('Criar Usuário', `Dar acesso ${novoUsuarioRole.toUpperCase()} para ${novoUsuarioEmail}?`, adicionarUsuarioDB, 'Criar Acesso')}
                disabled={isUpdatingUsuarios || !novoUsuarioNome.trim() || !novoUsuarioEmail.trim()}
                className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                + Liberar Acesso
              </button>
            </div>
          </div>

          {usuariosList.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">Nenhum usuário cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-3">Colaborador</th>
                    <th className="py-3 px-3">E-mail de Acesso</th>
                    <th className="py-3 px-3">Permissão</th>
                    <th className="py-3 px-3">Agenda Vinculada</th>
                    <th className="py-3 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-xs">
                  {usuariosList.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                      <td className="py-3.5 px-3 font-bold text-zinc-900 dark:text-white">{user.nome}</td>
                      <td className="py-3.5 px-3 text-zinc-500 font-mono">{user.email}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          user.role === 'admin'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400">{getNomeProfissional(user.profissional_id)}</td>
                      <td className="py-3.5 px-3 text-right space-x-1.5">
                        <button onClick={() => setEditUsuarioModal({ isOpen: true, id: user.id, nome: user.nome, role: user.role, profissional_id: user.profissional_id || '' })} disabled={isUpdatingUsuarios} className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                          Editar
                        </button>
                        <button onClick={() => solicitarRemocaoUsuario(user.id, user.nome)} disabled={isUpdatingUsuarios} className="px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium cursor-pointer">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA 4: INTEGRAÇÕES & SEGURANÇA ──────────────────────────────── */}
      {secaoAtiva === 'integracoes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Sincronização Google Calendar
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Google Calendar OAuth 2.0</span>
                  {hasGoogleToken ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold">
                      Conectado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold">
                      Não conectado
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Espelhe automaticamente todos os agendamentos nas agendas individuais dos profissionais.
                </p>
              </div>
              {hasGoogleToken ? (
                <button onClick={revogarGoogle} disabled={isUpdating} className="px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold cursor-pointer shrink-0">
                  Desconectar
                </button>
              ) : (
                <a
                  href={`https://soultech-ia.com.br/webhook/oauth/google?empresa_id=${empresa.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Vincular Conta
                </a>
              )}
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Alterar Senha de Acesso
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Atualize a credencial da sua conta administrativa atual.
            </p>
            <div className="flex gap-2.5">
              <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha (mín. 6 caracteres)" disabled={isUpdatingSenha} className={inputCls} />
              <button
                onClick={() => pedirConfirmacao('Atualizar Senha', 'Tem certeza que deseja alterar sua senha de acesso?', atualizarSenha, 'Atualizar')}
                disabled={isUpdatingSenha || !novaSenha || novaSenha.length < 6}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Salvar Senha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE EDIÇÃO */}
      {editUsuarioModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">Editar Acesso</h3>
            <form onSubmit={salvarEdicaoUsuario} className="space-y-3.5">
              <div><label className={labelCls}>Nome</label><input type="text" className={inputCls} required value={editUsuarioModal.nome} onChange={(e) => setEditUsuarioModal({...editUsuarioModal, nome: e.target.value})} disabled={isUpdatingUsuarios} /></div>
              <div>
                <label className={labelCls}>Acesso</label>
                <select className={inputCls} value={editUsuarioModal.role} onChange={(e) => setEditUsuarioModal({...editUsuarioModal, role: e.target.value})} disabled={isUpdatingUsuarios}>
                  <option value="basico">Básico</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Vincular Profissional</label>
                <select className={inputCls} value={editUsuarioModal.profissional_id} onChange={(e) => setEditUsuarioModal({...editUsuarioModal, profissional_id: e.target.value})} disabled={isUpdatingUsuarios}>
                  <option value="">(Nenhum)</option>
                  {profissionaisList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditUsuarioModal({ isOpen: false, id: null, nome: '', role: 'basico', profissional_id: '' })} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isUpdatingUsuarios} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editProfModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">Editar Profissional</h3>
            <form onSubmit={salvarEdicaoProfissional} className="space-y-3.5">
              <div><label className={labelCls}>Nome</label><input type="text" className={inputCls} required value={editProfModal.nome} onChange={(e) => setEditProfModal({...editProfModal, nome: e.target.value})} disabled={isUpdating} /></div>
              <div><label className={labelCls}>Comissão (%)</label><input type="number" className={inputCls} required value={editProfModal.comissao} onChange={(e) => setEditProfModal({...editProfModal, comissao: e.target.value})} disabled={isUpdating} /></div>
              <div><label className={labelCls}>ID da Agenda Google</label><input type="text" className={inputCls} value={editProfModal.calendar_id} onChange={(e) => setEditProfModal({...editProfModal, calendar_id: e.target.value})} disabled={isUpdating} placeholder="Deixe vazio para usar a principal" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditProfModal({ isOpen: false, id: null, nome: '', comissao: '', calendar_id: '' })} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editServicoModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">Editar Serviço</h3>
            <form onSubmit={salvarEdicaoServico} className="space-y-3.5">
              <div><label className={labelCls}>Nome do Serviço</label><input type="text" className={inputCls} required value={editServicoModal.novoNome} onChange={(e) => setEditServicoModal({...editServicoModal, novoNome: e.target.value})} disabled={isUpdating} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Preço (R$)</label><input type="number" className={inputCls} required value={editServicoModal.preco} onChange={(e) => setEditServicoModal({...editServicoModal, preco: e.target.value})} disabled={isUpdating} /></div>
                <div><label className={labelCls}>Duração (min)</label><input type="number" className={inputCls} required value={editServicoModal.duracao} onChange={(e) => setEditServicoModal({...editServicoModal, duracao: e.target.value})} disabled={isUpdating} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditServicoModal({ isOpen: false, oldNome: '', novoNome: '', preco: '', duracao: '' })} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-blue-700 text-xs font-semibold text-white cursor-pointer">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={fecharConfirmModal} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">Cancelar</button>
              <button onClick={() => { const acao = confirmModal.action; fecharConfirmModal(); acao && acao(); }} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
