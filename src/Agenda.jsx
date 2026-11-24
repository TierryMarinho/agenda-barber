import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/dist/locale/pt-br'
import 'react-big-calendar/lib/css/react-big-calendar.css'

moment.locale('pt-br')
const localizer = momentLocalizer(moment)

const formatosCalendario = {
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
  agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
  dayHeaderFormat: 'dddd, DD [de] MMMM [de] YYYY',
  dayFormat: 'ddd DD/MM',
  monthHeaderFormat: 'MMMM [de] YYYY',
  dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'DD/MM', culture)} - ${localizer.format(end, 'DD/MM', culture)}`,
}

const EventoCustomizado = ({ event }) => {
  const ext = event.extendedProps
  const isBloqueio = ext.status?.toLowerCase() === 'bloqueado'

  return (
    <div className="evento-wrapper">
      <div className="evento-texto">
        {event.title}
      </div>

      <div className="evento-tooltip">
        <div className="font-bold mb-1.5 pb-1.5 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white">
          {isBloqueio ? 'Bloqueio de Agenda' : 'Resumo do Agendamento'}
        </div>
        <div className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300 space-y-0.5">
          <div><strong className="text-zinc-900 dark:text-white">Cliente:</strong> {isBloqueio ? 'N/A' : (ext.nome_cliente || 'Não informado')}</div>
          <div><strong className="text-zinc-900 dark:text-white">Serviço:</strong> {ext.servico}</div>
          <div><strong className="text-zinc-900 dark:text-white">Horário:</strong> {ext.horario}</div>
          <div>
            <strong className="text-zinc-900 dark:text-white">Status:</strong>{' '}
            <span className="uppercase font-bold" style={{
              color: ext.status === 'concluido' ? '#10b981' : ext.status === 'cancelado' ? '#ef4444' : '#2563eb'
            }}>
              {ext.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Agenda({ empresaId, usuario }) {
  const isBasicUser = usuario?.role === 'basico'
  const [eventos, setEventos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [duracoesServicos, setDuracoesServicos] = useState({})
  const [comissoesMap, setComissoesMap] = useState({})
  const [loading, setLoading] = useState(true)

  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [currentView, setCurrentView] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [checkoutData, setCheckoutData] = useState({ forma_pagamento: 'pix', valor_cobrado: 0 })

  const [tipoRemocao, setTipoRemocao] = useState('unico')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState({})

  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [errorNovo, setErrorNovo] = useState('')

  const [isSearchingClient, setIsSearchingClient] = useState(false)
  const [sugestoesClientes, setSugestoesClientes] = useState([])
  const [mostrandoSugestoes, setMostrandoSugestoes] = useState(false)
  const [digitaNovo, setDigitaNovo] = useState(true)

  const [isSearchingEditClient, setIsSearchingEditClient] = useState(false)
  const [sugestoesEdit, setSugestoesEdit] = useState([])
  const [mostrandoSugestoesEdit, setMostrandoSugestoesEdit] = useState(false)
  const [digitaEdit, setDigitaEdit] = useState(true)

  const [novoFormData, setNovoFormData] = useState({
    nome_cliente: '', telefone: '', profissional_nome: '', servico: '', data: '', hora: '',
    is_recorrente: false, frequencia: 'semanal', fim_tipo: 'ocorrencias', fim_ocorrencias: 4, fim_data: ''
  })

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)
  const [errorBlock, setErrorBlock] = useState('')
  const [blockFormData, setBlockFormData] = useState({
    profissional: '', data: '', hora_inicio: '', hora_fim: '', motivo: 'Bloqueio de Agenda',
    is_recorrente: false, frequencia: 'diario', fim_tipo: 'ocorrencias', fim_ocorrencias: 5, fim_data: ''
  })

  const [errorEdit, setErrorEdit] = useState('')

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000)
  }

  const formatarTelefoneParaInput = (telDb) => {
    if (!telDb) return ''
    let clean = telDb.replace(/\D/g, '')
    if (clean.startsWith('55')) clean = clean.substring(2)
    if (clean.length > 7) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`
    if (clean.length > 2) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`
    return clean
  }

  useEffect(() => {
    if (filtroProfissional) {
      setCurrentView('week')
    } else {
      setCurrentView('day')
    }
  }, [filtroProfissional])

  useEffect(() => {
    if (empresaId) carregarDadosDaAgenda()
  }, [empresaId, usuario])

  useEffect(() => {
    if (!isNovoModalOpen || !digitaNovo) return
    const termo = novoFormData.nome_cliente || ''
    if (termo.length >= 2) {
      setIsSearchingClient(true)
      const delayDebounceFn = setTimeout(async () => {
        const { data } = await supabase.from('clientes').select('nome, telefone').ilike('nome', `%${termo}%`).eq('empresa_id', empresaId).limit(5)
        setSugestoesClientes(data || []); setMostrandoSugestoes(true); setIsSearchingClient(false)
      }, 500)
      return () => clearTimeout(delayDebounceFn)
    } else { setMostrandoSugestoes(false); setSugestoesClientes([]) }
  }, [novoFormData.nome_cliente, empresaId, isNovoModalOpen, digitaNovo])

  useEffect(() => {
    if (!isModalOpen || !isEditMode || !digitaEdit) return
    const termo = editFormData.nome_cliente || ''
    if (termo.length >= 2) {
      setIsSearchingEditClient(true)
      const delayDebounceFn = setTimeout(async () => {
        const { data } = await supabase.from('clientes').select('nome, telefone').ilike('nome', `%${termo}%`).eq('empresa_id', empresaId).limit(5)
        setSugestoesEdit(data || []); setMostrandoSugestoesEdit(true); setIsSearchingEditClient(false)
      }, 500)
      return () => clearTimeout(delayDebounceFn)
    } else { setMostrandoSugestoesEdit(false); setSugestoesEdit([]) }
  }, [editFormData.nome_cliente, empresaId, isModalOpen, isEditMode, digitaEdit])

  const handleSelecionarSugestaoNovo = (cliente) => {
    setDigitaNovo(false)
    setNovoFormData(prev => ({ ...prev, nome_cliente: cliente.nome, telefone: formatarTelefoneParaInput(cliente.telefone) }))
    setMostrandoSugestoes(false)
  }

  const handleSelecionarSugestaoEdit = (cliente) => {
    setDigitaEdit(false)
    setEditFormData(prev => ({ ...prev, nome_cliente: cliente.nome, telefone: formatarTelefoneParaInput(cliente.telefone) }))
    setMostrandoSugestoesEdit(false)
  }

  const carregarDadosDaAgenda = async () => {
    setLoading(true)

    const { data: pData } = await supabase.from('profissionais').select('id, nome, percentual_comissao').eq('empresa_id', empresaId)
    let profMap = {}
    if (pData) {
      setProfissionais(pData.map(p => p.nome))
      pData.forEach(p => profMap[p.nome] = p.percentual_comissao || 0)
      setComissoesMap(profMap)

      if (usuario?.role === 'basico' && usuario?.profissional_id && !filtroProfissional) {
        const profVinculado = pData.find(p => p.id === usuario.profissional_id)
        if (profVinculado) setFiltroProfissional(profVinculado.nome)
      }
    }

    const { data: empData } = await supabase.from('empresas').select('precos_servicos, duracao_servicos').eq('id', empresaId).single()
    let duracoesMap = {}
    if (empData) {
      if (empData.precos_servicos) setServicos(Object.keys(empData.precos_servicos))
      if (empData.duracao_servicos) {
        duracoesMap = empData.duracao_servicos
        setDuracoesServicos(empData.duracao_servicos)
      }
    }

    const { data: evData, error } = await supabase.from('agendamentos').select('*').eq('empresa_id', empresaId)

    if (error) {
      showToast("Erro ao carregar a agenda.", "error")
    } else if (evData) {
      const eventosFormatados = evData.map(ag => {
        let corBase = '#1e3a8a'
        if (ag.status?.toLowerCase() === 'concluido') corBase = '#059669'
        if (ag.status?.toLowerCase() === 'cancelado') corBase = '#dc2626'
        if (ag.status?.toLowerCase() === 'ausente') corBase = '#52525b'
        if (ag.status?.toLowerCase() === 'bloqueado') corBase = 'var(--bg-tabs)'

        const dataIso = ag.data_hora ? ag.data_hora.replace(' ', 'T') : null
        let dataApenas = ''
        let horaStr = ''
        if (dataIso) {
          const parts = dataIso.split('T')
          dataApenas = parts[0]
          horaStr = parts[1] ? parts[1].substring(0, 5) : ''
        }

        let horaFimStr = ag.hora_fim ? ag.hora_fim.substring(0, 5) : ''

        if (!horaFimStr && horaStr) {
          const duracao = parseInt(duracoesMap[ag.servico]) || 30
          const [h, m] = horaStr.split(':').map(Number)
          const totalMin = (h * 60) + m + duracao
          const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0')
          const endM = String(totalMin % 60).padStart(2, '0')
          horaFimStr = `${endH}:${endM}`
        }

        const horarioFormatado = `${horaStr} às ${horaFimStr}`
        let endIso = null
        if (horaFimStr && dataApenas) endIso = `${dataApenas}T${horaFimStr}:00`

        const isBloqueio = ag.status?.toLowerCase() === 'bloqueado'
        const tituloBase = isBloqueio ? `⛔ ${ag.servico || 'Bloqueio'}` : `${ag.nome_cliente || ag.telefone} • ${ag.servico}`
        const exibirNome = !filtroProfissional && usuario?.role !== 'basico'
        const titleFinal = exibirNome ? `${tituloBase} (${ag.profissional})` : tituloBase

        return {
          id: ag.id,
          title: titleFinal,
          start: new Date(dataIso),
          end: endIso ? new Date(endIso) : new Date(new Date(dataIso).getTime() + 30 * 60000),
          resourceId: ag.profissional,
          backgroundColor: corBase,
          borderColor: corBase,
          extendedProps: {
            ...ag,
            horario: horarioFormatado,
            hora_inicio: horaStr,
            hora_fim: horaFimStr
          }
        }
      })

      setEventos(eventosFormatados)
    }
    setLoading(false)
  }

  const eventStyleGetter = (event) => {
    const isBloqueio = event.extendedProps.status?.toLowerCase() === 'bloqueado'
    return {
      style: {
        backgroundColor: event.backgroundColor,
        borderColor: event.borderColor,
        color: isBloqueio ? 'var(--text-strong)' : '#ffffff'
      }
    }
  }

  const timeToMins = (t) => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return (h * 60) + m
  }

  const checkOverlap = (dataDesejada, horaInicioDesejada, horaFimDesejada, profissionalNome) => {
    const startMin = timeToMins(horaInicioDesejada)
    const endMin = timeToMins(horaFimDesejada)
    return eventos.some(ev => {
      if (ev.extendedProps.profissional !== profissionalNome) return false
      if (ev.extendedProps.status !== 'ativo' && ev.extendedProps.status !== 'bloqueado') return false

      const evDate = moment(ev.start).format('YYYY-MM-DD')
      if (evDate !== dataDesejada) return false

      const evStartMin = timeToMins(ev.extendedProps.hora_inicio)
      const evEndMin = ev.extendedProps.hora_fim ? timeToMins(ev.extendedProps.hora_fim) : evStartMin + 30
      return (startMin < evEndMin) && (endMin > evStartMin)
    })
  }

  const calcularDatas = (dataInicial, freq, fimTipo, ocorrencias, dataFim) => {
    const datas = []
    let dataAtual = new Date(`${dataInicial}T12:00:00`)
    const limite = fimTipo === 'ocorrencias' ? parseInt(ocorrencias) || 1 : 50
    const limiteDataObj = fimTipo === 'data' && dataFim ? new Date(`${dataFim}T12:00:00`) : null
    let count = 0
    while (count < limite && count < 50) {
      if (limiteDataObj && dataAtual > limiteDataObj) break
      const yyyy = dataAtual.getFullYear()
      const mm = String(dataAtual.getMonth() + 1).padStart(2, '0')
      const dd = String(dataAtual.getDate()).padStart(2, '0')
      datas.push(`${yyyy}-${mm}-${dd}`)
      if (freq === 'diario') dataAtual.setDate(dataAtual.getDate() + 1)
      else if (freq === 'semanal') dataAtual.setDate(dataAtual.getDate() + 7)
      else if (freq === 'quinzenal') dataAtual.setDate(dataAtual.getDate() + 14)
      else if (freq === 'mensal') dataAtual.setMonth(dataAtual.getMonth() + 1)
      count++
    }
    return datas
  }

  const handleTelefoneChange = (e, targetForm, setTargetForm) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 11) val = val.slice(0, 11)
    let formatted = val
    if (val.length > 2 && val.length <= 7) formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`
    else if (val.length > 7) formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`
    else if (val.length > 0) formatted = `(${val}`
    setTargetForm({...targetForm, telefone: formatted})
  }

  const handleNovoAgendamentoSubmit = async (e) => {
    if (e) e.preventDefault()
    setErrorNovo('')

    const nome = novoFormData.nome_cliente || ''
    if (nome.trim() === '') return setErrorNovo("Preencha o nome do cliente.")
    const tel = novoFormData.telefone || ''
    const telefoneNumeros = tel.replace(/\D/g, '')
    if (telefoneNumeros.length !== 11) return setErrorNovo("O WhatsApp deve conter o DDD e 9 dígitos.")
    if (!novoFormData.profissional_nome) return setErrorNovo("Selecione um profissional.")
    if (!novoFormData.servico) return setErrorNovo("Selecione um serviço.")
    if (!novoFormData.data) return setErrorNovo("Selecione a data.")
    if (!novoFormData.hora) return setErrorNovo("Selecione o horário.")

    if (novoFormData.is_recorrente) {
      if (novoFormData.fim_tipo === 'ocorrencias') {
        const qtd = parseInt(novoFormData.fim_ocorrencias)
        if (!qtd || qtd < 2) return setErrorNovo("Preencha o número de repetições.")
        if (qtd > 50) return setErrorNovo("O limite de segurança é de 50 ocorrências.")
      }
      if (novoFormData.fim_tipo === 'data' && !novoFormData.fim_data) return setErrorNovo("Preencha a data limite da repetição.")
    }

    setIsCreating(true)

    try {
      const datas = novoFormData.is_recorrente
        ? calcularDatas(novoFormData.data, novoFormData.frequencia, novoFormData.fim_tipo, novoFormData.fim_ocorrencias, novoFormData.fim_data)
        : [novoFormData.data]

      if (datas.length > 50) {
        setIsCreating(false)
        return setErrorNovo("O limite de segurança é de 50 ocorrências.")
      }

      const duracao = parseInt(duracoesServicos[novoFormData.servico]) || 30
      const startMins = timeToMins(novoFormData.hora)
      const endMins = startMins + duracao
      const horaFimCalculada = `${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`

      const conflitos = []
      for (const d of datas) {
        if (checkOverlap(d, novoFormData.hora, horaFimCalculada, novoFormData.profissional_nome)) {
          conflitos.push(d.split('-').reverse().join('/'))
        }
      }

      if (conflitos.length > 0) {
        setErrorNovo(`Conflito de horário! O profissional possui atividade às ${novoFormData.hora} no dia ${conflitos[0]}`)
        setIsCreating(false)
        return
      }

      const idSerie = datas.length > 1 ? (crypto.randomUUID?.() || Math.random().toString(36).substring(2,15)) : null

      const records = datas.map(d => ({
        empresa_id: empresaId,
        nome_cliente: novoFormData.nome_cliente,
        telefone: `55${telefoneNumeros}`,
        profissional: novoFormData.profissional_nome,
        servico: novoFormData.servico,
        data_agendamento: d,
        data_hora: `${d} ${novoFormData.hora}:00`,
        hora_fim: horaFimCalculada,
        status: 'ativo',
        id_serie: idSerie,
        id_evento_google: 'sync_pending'
      }))

      const { error } = await supabase.from('agendamentos').insert(records)
      if (error) {
        setErrorNovo('Não foi possível salvar o agendamento. Tente novamente.')
        return
      }

      showToast(datas.length > 1 ? "Agendamento recorrente adicionado!" : "Agendamento adicionado!")
      fecharNovoModal()
      carregarDadosDaAgenda()

      const payload = datas.length === 1
        ? { ...records[0], data: records[0].data_agendamento, hora: novoFormData.hora }
        : { is_recorrente: true, id_serie: idSerie, eventos: records.map(r => ({ ...r, data: r.data_agendamento, hora: novoFormData.hora })) }

      fetch('https://soultech-ia.com.br/webhook/marcar-horario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).catch(() => {})

      setTimeout(() => carregarDadosDaAgenda(), 8000)

    } catch { setErrorNovo("Falha geral no sistema.") } finally { setIsCreating(false) }
  }

  const handleBloqueioSubmit = async (e) => {
    if (e) e.preventDefault()
    setErrorBlock('')

    if (!blockFormData.profissional) return setErrorBlock("Selecione um profissional.")
    if (!blockFormData.data) return setErrorBlock("Selecione a data.")
    if (!blockFormData.hora_inicio) return setErrorBlock("Selecione a hora de início.")
    if (!blockFormData.hora_fim) return setErrorBlock("Selecione a hora de fim.")

    if (blockFormData.is_recorrente) {
      if (blockFormData.fim_tipo === 'ocorrencias') {
        const qtd = parseInt(blockFormData.fim_ocorrencias)
        if (!qtd || qtd < 2) return setErrorBlock("Preencha repetições válidas.")
        if (qtd > 50) return setErrorBlock("O limite máximo é de 50 repetições por vez.")
      }
      if (blockFormData.fim_tipo === 'data' && !blockFormData.fim_data) return setErrorBlock("Preencha a data limite.")
    }

    setIsBlocking(true)

    try {
      const datas = blockFormData.is_recorrente ? calcularDatas(blockFormData.data, blockFormData.frequencia, blockFormData.fim_tipo, blockFormData.fim_ocorrencias, blockFormData.fim_data) : [blockFormData.data]

      if (datas.length > 50) {
        setIsBlocking(false)
        return setErrorBlock("O limite de segurança é de 50 ocorrências.")
      }

      const conflitos = []
      for (const d of datas) {
        if (checkOverlap(d, blockFormData.hora_inicio, blockFormData.hora_fim, blockFormData.profissional)) conflitos.push(d.split('-').reverse().join('/'))
      }

      if (conflitos.length > 0) {
        setErrorBlock(`Conflito! Já existe um evento neste intervalo no dia ${conflitos[0]}.`)
        setIsBlocking(false)
        return
      }

      const idSerie = datas.length > 1 ? (crypto.randomUUID?.() || Math.random().toString(36).substring(2,15)) : null

      const records = datas.map(d => ({
        empresa_id: empresaId,
        nome_cliente: 'BLOQUEIO DE AGENDA',
        telefone: '00000000000',
        profissional: blockFormData.profissional,
        servico: blockFormData.motivo || 'Bloqueio de Agenda',
        data_agendamento: d,
        data_hora: `${d} ${blockFormData.hora_inicio}:00`,
        hora_fim: blockFormData.hora_fim,
        status: 'bloqueado',
        id_serie: idSerie,
        id_evento_google: 'sync_pending'
      }))

      await supabase.from('agendamentos').insert(records)

      showToast(datas.length > 1 ? "Bloqueio recorrente adicionado!" : "Bloqueio adicionado!")
      fecharBlockModal()
      carregarDadosDaAgenda()

      const payload = datas.length === 1
        ? { ...records[0], data: records[0].data_agendamento, hora_inicio: blockFormData.hora_inicio }
        : { is_recorrente: true, id_serie: idSerie, bloqueios: records.map(r => ({ ...r, data: r.data_agendamento, hora_inicio: blockFormData.hora_inicio })) }

      fetch('https://soultech-ia.com.br/webhook/bloquear-agenda', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).catch(() => {})

      setTimeout(() => carregarDadosDaAgenda(), 8000)

    } catch { setErrorBlock("Falha geral no sistema.") } finally { setIsBlocking(false) }
  }

  const handleSelectSlot = (slotInfo) => {
    const { start, resourceId } = slotInfo
    const now = new Date()

    if (start < now && start.toDateString() !== now.toDateString()) {
      showToast("Não é possível agendar em horários no passado.", "warning")
      return
    }

    const dataString = moment(start).format('YYYY-MM-DD')
    const horaString = moment(start).format('HH:mm')

    setNovoFormData({
      ...novoFormData,
      data: dataString,
      hora: horaString,
      profissional_nome: isBasicUser ? filtroProfissional : (resourceId || filtroProfissional || profissionais[0] || ''),
      servico: servicos[0] || '',
      is_recorrente: false
    })

    setDigitaNovo(true)
    setIsNovoModalOpen(true)
    setErrorNovo('')
  }

  const handleSelectEvent = (event) => {
    const ext = event.extendedProps
    setSelectedEvent({ id: event.id, title: event.title, ...ext })

    setEditFormData({
      nome_cliente: ext.nome_cliente || '',
      telefone: ext.telefone || '',
      profissional: ext.profissional || '',
      servico: ext.servico || '',
      data_agendamento: ext.data_agendamento || moment(event.start).format('YYYY-MM-DD'),
      hora_inicio: ext.hora_inicio || moment(event.start).format('HH:mm'),
      hora_fim: ext.hora_fim || (event.end ? moment(event.end).format('HH:mm') : '')
    })
    setIsEditMode(false)
    setIsModalOpen(true)
    setErrorEdit('')
    setIsConfirmDeleteOpen(false)
    setIsCheckoutOpen(false)
    setTipoRemocao('unico')
    setDigitaEdit(true)
  }

  const fecharModal = () => {
    setIsModalOpen(false)
    setSelectedEvent(null)
    setIsEditMode(false)
    setTipoRemocao('unico')
    setErrorEdit('')
    setIsConfirmDeleteOpen(false)
    setIsCheckoutOpen(false)
    setIsSearchingEditClient(false)
    setMostrandoSugestoesEdit(false)
  }

  const fecharNovoModal = () => {
    setIsNovoModalOpen(false)
    setErrorNovo('')
    setIsSearchingClient(false)
    setMostrandoSugestoes(false)
  }

  const fecharBlockModal = () => { setIsBlockModalOpen(false); setErrorBlock('') }

  const handleSalvarEdicao = async (e) => {
    if (e) e.preventDefault()
    setErrorEdit('')

    const isBloqueio = selectedEvent.status?.toLowerCase() === 'bloqueado'
    if (!isBloqueio) {
      const nome = editFormData.nome_cliente || ''
      if (nome.trim() === '') return setErrorEdit("Preencha o nome do cliente.")
      const tel = editFormData.telefone || ''
      const telefoneLimpoCheck = tel.replace(/\D/g, '')
      if (telefoneLimpoCheck.length !== 11 && !(telefoneLimpoCheck.startsWith('55') && telefoneLimpoCheck.length === 13)) {
        return setErrorEdit("O WhatsApp deve conter DDD e 9 dígitos.")
      }
    }

    if (!editFormData.profissional) return setErrorEdit("Selecione um profissional.")
    if (!editFormData.servico || editFormData.servico.trim() === '') return setErrorEdit(isBloqueio ? "Preencha o motivo do bloqueio." : "Selecione um serviço.")
    if (!editFormData.data_agendamento) return setErrorEdit("Selecione a data.")
    if (!editFormData.hora_inicio) return setErrorEdit("Selecione a hora de início.")

    setIsUpdating(true)

    try {
      let rawTel = isBloqueio ? '00000000000' : editFormData.telefone.replace(/\D/g, '')
      if (!isBloqueio && !rawTel.startsWith('55')) rawTel = `55${rawTel}`

      if (tipoRemocao === 'serie' && selectedEvent.id_serie) {
        const { data: futureEvents } = await supabase.from('agendamentos')
          .select('id, data_agendamento, id_evento_google, profissional')
          .eq('id_serie', selectedEvent.id_serie)
          .gte('data_hora', selectedEvent.data_hora)

        if (futureEvents && futureEvents.length > 0) {
          for (const ev of futureEvents) {
            const newDateHora = `${ev.data_agendamento} ${editFormData.hora_inicio}:00`
            await supabase.from('agendamentos').update({
              nome_cliente: isBloqueio ? 'BLOQUEIO DE AGENDA' : editFormData.nome_cliente,
              telefone: rawTel,
              profissional: editFormData.profissional,
              servico: editFormData.servico,
              data_hora: newDateHora,
              hora_fim: editFormData.hora_fim || null
            }).eq('id', ev.id)
          }

          showToast(isBloqueio ? "Bloqueio recorrente atualizado!" : "Agendamento recorrente atualizado!")
          carregarDadosDaAgenda()
          fecharModal()
        }
      } else {
        const { error } = await supabase.from('agendamentos').update({
          nome_cliente: isBloqueio ? 'BLOQUEIO DE AGENDA' : editFormData.nome_cliente,
          telefone: rawTel,
          profissional: editFormData.profissional,
          servico: editFormData.servico,
          data_agendamento: editFormData.data_agendamento,
          data_hora: `${editFormData.data_agendamento} ${editFormData.hora_inicio}:00`,
          hora_fim: editFormData.hora_fim || null
        }).eq('id', selectedEvent.id).eq('empresa_id', empresaId)

        if (error) { setErrorEdit("Falha ao salvar no banco.") } else {
          showToast(isBloqueio ? "Bloqueio atualizado!" : "Agendamento atualizado!")
          carregarDadosDaAgenda()
          fecharModal()
        }
      }
    } finally { setIsUpdating(false) }
  }

  const executarExclusaoTotal = async () => {
    setIsConfirmDeleteOpen(false)
    setIsUpdating(true)
    const isBloqueio = selectedEvent.status?.toLowerCase() === 'bloqueado'

    try {
      if (tipoRemocao === 'serie' && selectedEvent.id_serie) {
        const { error } = await supabase.from('agendamentos').delete()
          .eq('empresa_id', empresaId)
          .eq('id_serie', selectedEvent.id_serie)
          .gte('data_hora', selectedEvent.data_hora)
        if (error) throw error
      } else {
        const { error } = await supabase.from('agendamentos').delete().eq('id', selectedEvent.id).eq('empresa_id', empresaId)
        if (error) throw error
      }

      showToast(tipoRemocao === 'serie'
        ? (isBloqueio ? "Bloqueio recorrente removido!" : "Agendamento recorrente removido!")
        : (isBloqueio ? "Bloqueio removido!" : "Agendamento removido!")
      )

      carregarDadosDaAgenda()
      fecharModal()
    } catch {
      showToast("Falha ao excluir no banco de dados.", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  const abrirCheckout = () => {
    setCheckoutData({ forma_pagamento: 'pix', valor_cobrado: selectedEvent.valor || 0 })
    setIsCheckoutOpen(true)
  }

  const confirmarCheckout = async (e) => {
    e.preventDefault()
    setIsUpdating(true)

    try {
      const percComissao = comissoesMap[selectedEvent.profissional] || 0
      const valorComissaoReal = (checkoutData.valor_cobrado * (percComissao / 100)).toFixed(2)

      let query = supabase.from('agendamentos').update({
        status: 'concluido',
        forma_pagamento: checkoutData.forma_pagamento,
        status_pagamento: 'pago',
        valor: checkoutData.valor_cobrado,
        valor_comissao: valorComissaoReal
      }).eq('empresa_id', empresaId)

      if (tipoRemocao === 'serie' && selectedEvent.id_serie) query = query.eq('id_serie', selectedEvent.id_serie).gte('data_hora', selectedEvent.data_hora)
      else query = query.eq('id', selectedEvent.id)

      const { error } = await query
      if (error) {
        showToast("Falha ao registrar pagamento.", "error")
      } else {
        showToast("Atendimento fechado com sucesso!", "success")
        setIsCheckoutOpen(false)
        carregarDadosDaAgenda()
        fecharModal()
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const atualizarStatus = async (novoStatus) => {
    if (!selectedEvent) return
    setIsUpdating(true)
    const isBloqueio = selectedEvent.status?.toLowerCase() === 'bloqueado'

    try {
      let statusPag = novoStatus === 'cancelado' ? 'cancelado' : 'pendente'

      let query = supabase.from('agendamentos').update({
        status: novoStatus,
        status_pagamento: statusPag
      }).eq('empresa_id', empresaId)

      if (tipoRemocao === 'serie' && selectedEvent.id_serie) query = query.eq('id_serie', selectedEvent.id_serie).gte('data_hora', selectedEvent.data_hora)
      else query = query.eq('id', selectedEvent.id)

      const { error } = await query
      if (error) {
        showToast("Falha ao atualizar status.", "error")
      } else {
        showToast(tipoRemocao === 'serie'
          ? (isBloqueio ? "Status do bloqueio recorrente atualizado!" : "Status do agendamento recorrente atualizado!")
          : "Status atualizado com sucesso!"
        )
        carregarDadosDaAgenda()
        fecharModal()
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const eventosFiltrados = filtroProfissional ? eventos.filter(ev => ev.extendedProps.profissional === filtroProfissional) : eventos
  const resourcesList = profissionais.map(p => ({ id: p, title: p }))

  if (loading) return <div className="py-12 text-center text-sm text-zinc-500">Sincronizando grade de horários...</div>

  const isPendingSync = selectedEvent?.is_pending

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900"
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1"

  return (
    <div className="space-y-4 relative animate-fade-in">
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white ${
          toast.type === 'success' ? 'bg-zinc-900 dark:bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* BARRA DE CONTROLES DA AGENDA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          {isBasicUser ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Agenda Individual: {filtroProfissional}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Profissional:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFiltroProfissional('')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    filtroProfissional === ''
                      ? 'bg-zinc-900 dark:bg-blue-700 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Todos (Visão Diária)
                </button>
                {profissionais.map(p => (
                  <button
                    key={p}
                    onClick={() => setFiltroProfissional(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filtroProfissional === p
                        ? 'bg-zinc-900 dark:bg-blue-700 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isBasicUser && (
            <button
              onClick={() => {
                const hoje = new Date().toISOString().split('T')[0]
                setBlockFormData({ ...blockFormData, data: hoje, profissional: filtroProfissional || profissionais[0] || '', is_recorrente: false })
                setIsBlockModalOpen(true)
                setErrorBlock('')
              }}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Bloquear Horário
            </button>
          )}
          <button
            onClick={() => {
              const hoje = new Date().toISOString().split('T')[0]
              setNovoFormData({ ...novoFormData, data: hoje, profissional_nome: filtroProfissional || profissionais[0] || '', servico: servicos[0] || '', is_recorrente: false })
              setDigitaNovo(true)
              setIsNovoModalOpen(true)
              setErrorNovo('')
            }}
            className="px-4 py-2 bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            + Novo Agendamento
          </button>
        </div>
      </div>

      {/* CALENDÁRIO */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200/80 dark:border-zinc-800 overflow-hidden p-3 sm:p-4">
        <div className="calendario-container overflow-x-auto overflow-y-auto w-full rounded-xl">
          <div style={{ minWidth: '800px' }}>
            <Calendar
              localizer={localizer}
              events={eventosFiltrados}
              view={currentView}
              onView={(view) => setCurrentView(view)}
              date={currentDate}
              onNavigate={(date) => setCurrentDate(date)}
              views={['day', 'week', 'month']}
              step={30}
              timeslots={1}
              min={new Date(1970, 1, 1, 7, 0, 0)}
              max={new Date(1970, 1, 1, 22, 0, 0)}
              resources={!isBasicUser && currentView === 'day' && !filtroProfissional ? resourcesList : undefined}
              resourceIdAccessor="id"
              resourceTitleAccessor="title"
              selectable={true}
              longPressThreshold={500}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              components={{ event: EventoCustomizado }}
              formats={formatosCalendario}
              style={{ height: '75vh', minHeight: '600px' }}
              messages={{
                today: 'Hoje', previous: '←', next: '→', month: 'Mês', week: 'Semana', day: 'Dia', agenda: 'Agenda', date: 'Data', time: 'Hora', event: 'Evento', noEventsInRange: 'Não há eventos neste período.', showMore: total => `+ mais ${total}`
              }}
            />
          </div>
        </div>
      </div>

      {/* MODAL BLOQUEAR AGENDA */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Bloquear Horário na Agenda
            </h3>
            <form className="space-y-3.5">
              <div>
                <label className={labelCls}>Profissional</label>
                <select className={inputCls} value={blockFormData.profissional} onChange={e => setBlockFormData({...blockFormData, profissional: e.target.value})}>
                  {profissionais.length === 0 && <option value="">Sem profissionais</option>}
                  {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Data do Bloqueio</label>
                <input type="date" className={inputCls} value={blockFormData.data} onChange={e => setBlockFormData({...blockFormData, data: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Início</label>
                  <input type="time" className={inputCls} value={blockFormData.hora_inicio} onChange={e => setBlockFormData({...blockFormData, hora_inicio: e.target.value})} />
                </div>
                <div>
                  <label className={labelCls}>Fim</label>
                  <input type="time" className={inputCls} value={blockFormData.hora_fim} onChange={e => setBlockFormData({...blockFormData, hora_fim: e.target.value})} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Motivo (Opcional)</label>
                <input type="text" placeholder="Ex: Almoço, Folga, Reunião" className={inputCls} value={blockFormData.motivo} onChange={e => setBlockFormData({...blockFormData, motivo: e.target.value})} />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-900 dark:text-white">
                  <input type="checkbox" checked={blockFormData.is_recorrente} onChange={e => setBlockFormData({...blockFormData, is_recorrente: e.target.checked})} className="accent-zinc-900 dark:accent-blue-600" />
                  Repetir Bloqueio
                </label>

                {blockFormData.is_recorrente && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelCls}>Frequência</label>
                      <select className={inputCls} value={blockFormData.frequencia} onChange={e => setBlockFormData({...blockFormData, frequencia: e.target.value})}>
                        <option value="diario">Todos os dias</option>
                        <option value="semanal">Semanalmente</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Termina em</label>
                        <select className={inputCls} value={blockFormData.fim_tipo} onChange={e => setBlockFormData({...blockFormData, fim_tipo: e.target.value})}>
                          <option value="ocorrencias">Após X vezes</option>
                          <option value="data">Em uma data</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{blockFormData.fim_tipo === 'ocorrencias' ? 'Quantidade' : 'Data Limite'}</label>
                        {blockFormData.fim_tipo === 'ocorrencias' ? (
                          <input type="number" min="2" className={inputCls} value={blockFormData.fim_ocorrencias} onChange={e => setBlockFormData({...blockFormData, fim_ocorrencias: e.target.value})} placeholder="Ex: 5" />
                        ) : (
                          <input type="date" className={inputCls} value={blockFormData.fim_data} onChange={e => setBlockFormData({...blockFormData, fim_data: e.target.value})} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errorBlock && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium">
                  {errorBlock}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" disabled={isBlocking} onClick={fecharBlockModal} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={handleBloqueioSubmit} disabled={isBlocking} className="flex-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO AGENDAMENTO */}
      {isNovoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              Novo Agendamento
            </h3>
            <form className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <label className={labelCls}>
                    Nome do Cliente {isSearchingClient && <span className="text-blue-600 lowercase font-normal ml-1">buscando...</span>}
                  </label>
                  <input type="text" placeholder="Ex: João Silva" className={inputCls} value={novoFormData.nome_cliente} onChange={e => { setDigitaNovo(true); setNovoFormData({...novoFormData, nome_cliente: e.target.value})}} />
                  {mostrandoSugestoes && sugestoesClientes.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {sugestoesClientes.map((c, i) => (
                        <li key={i} onClick={() => handleSelecionarSugestaoNovo(c)} className="px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs">
                          <div className="font-semibold text-zinc-900 dark:text-white">{c.nome}</div>
                          <div className="text-[11px] text-zinc-500">{formatarTelefoneParaInput(c.telefone)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className={labelCls}>WhatsApp (com DDD)</label>
                  <input type="text" placeholder="(27) 99999-9999" className={inputCls} value={novoFormData.telefone} onChange={(e) => handleTelefoneChange(e, novoFormData, setNovoFormData)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Profissional</label>
                  {isBasicUser ? (
                    <input className={inputCls} value={novoFormData.profissional_nome} readOnly />
                  ) : (
                    <select className={inputCls} value={novoFormData.profissional_nome} onChange={e => setNovoFormData({...novoFormData, profissional_nome: e.target.value})}>
                      {profissionais.length === 0 && <option value="">Sem profissionais</option>}
                      {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Serviço</label>
                  <select className={inputCls} value={novoFormData.servico} onChange={e => setNovoFormData({...novoFormData, servico: e.target.value})}>
                    {servicos.length === 0 && <option value="">Sem serviços</option>}
                    {servicos.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" className={inputCls} value={novoFormData.data} onChange={e => setNovoFormData({...novoFormData, data: e.target.value})} />
                </div>
                <div>
                  <label className={labelCls}>Horário</label>
                  <input type="time" className={inputCls} value={novoFormData.hora} onChange={e => setNovoFormData({...novoFormData, hora: e.target.value})} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-900 dark:text-white">
                  <input type="checkbox" checked={novoFormData.is_recorrente} onChange={e => setNovoFormData({...novoFormData, is_recorrente: e.target.checked})} className="accent-zinc-900 dark:accent-blue-600" />
                  Repetir Agendamento
                </label>

                {novoFormData.is_recorrente && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelCls}>Frequência</label>
                      <select className={inputCls} value={novoFormData.frequencia} onChange={e => setNovoFormData({...novoFormData, frequencia: e.target.value})}>
                        <option value="semanal">Semanalmente</option>
                        <option value="quinzenal">A cada 15 dias</option>
                        <option value="mensal">Mensalmente</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Termina em</label>
                        <select className={inputCls} value={novoFormData.fim_tipo} onChange={e => setNovoFormData({...novoFormData, fim_tipo: e.target.value})}>
                          <option value="ocorrencias">Após X vezes</option>
                          <option value="data">Em uma data</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{novoFormData.fim_tipo === 'ocorrencias' ? 'Quantidade' : 'Data Limite'}</label>
                        {novoFormData.fim_tipo === 'ocorrencias' ? (
                          <input type="number" min="2" className={inputCls} value={novoFormData.fim_ocorrencias} onChange={e => setNovoFormData({...novoFormData, fim_ocorrencias: e.target.value})} placeholder="Ex: 4" />
                        ) : (
                          <input type="date" className={inputCls} value={novoFormData.fim_data} onChange={e => setNovoFormData({...novoFormData, fim_data: e.target.value})} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errorNovo && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium">
                  {errorNovo}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" disabled={isCreating} onClick={fecharNovoModal} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={handleNovoAgendamentoSubmit} disabled={isCreating} className="flex-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-blue-950 dark:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES & EDIÇÃO */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">

          {!isConfirmDeleteOpen && !isCheckoutOpen && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {selectedEvent.status?.toLowerCase() === 'bloqueado' ? 'Detalhes do Bloqueio' : 'Detalhes do Atendimento'}
                </h3>
                <button onClick={fecharModal} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer">✕</button>
              </div>

              {isPendingSync && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium mb-4">
                  Sincronizando evento no servidor...
                </div>
              )}

              {!isEditMode ? (
                <>
                  <div className="space-y-2.5 text-xs mb-5 bg-zinc-50/70 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{selectedEvent.status?.toLowerCase() === 'bloqueado' ? 'Motivo' : 'Cliente / Serviço'}</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{selectedEvent.title.split(' (')[0].replace('⛔ ', '')}</span>
                    </div>

                    {!isBasicUser && selectedEvent.status?.toLowerCase() !== 'bloqueado' && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Contato</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">{selectedEvent.telefone || 'Não informado'}</span>
                          {selectedEvent.telefone && (
                            <a href={`https://wa.me/${selectedEvent.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-zinc-500">Horário</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">{selectedEvent.horario}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">Profissional</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">{selectedEvent.profissional}</span>
                    </div>

                    {selectedEvent.status?.toLowerCase() !== 'bloqueado' && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Valor</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {selectedEvent.valor || '0.00'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-zinc-500">Status</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-white text-[10px] font-bold uppercase">
                        {selectedEvent.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button disabled={isUpdating || isPendingSync} onClick={() => setIsEditMode(true)} className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                        Editar
                      </button>
                      {!isBasicUser && (
                        <button disabled={isUpdating || isPendingSync} onClick={() => setIsConfirmDeleteOpen(true)} className="flex-1 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer">
                          Excluir
                        </button>
                      )}
                    </div>

                    {selectedEvent.status?.toLowerCase() !== 'bloqueado' ? (
                      <div className="pt-2 space-y-2">
                        {!isBasicUser && (
                          <button disabled={isUpdating || isPendingSync || selectedEvent.status?.toLowerCase() === 'concluido'} onClick={abrirCheckout} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40">
                            Fechar Conta (Checkout)
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button disabled={isUpdating || isPendingSync || selectedEvent.status?.toLowerCase() === 'ausente'} onClick={() => atualizarStatus('ausente')} className="py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer disabled:opacity-40">
                            Não Compareceu
                          </button>
                          <button disabled={isUpdating || isPendingSync || selectedEvent.status?.toLowerCase() === 'cancelado'} onClick={() => atualizarStatus('cancelado')} className="py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer disabled:opacity-40">
                            Cancelar Horário
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button disabled={isUpdating || isPendingSync} onClick={() => setIsConfirmDeleteOpen(true)} className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer">
                        Remover Bloqueio
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <form className="space-y-3.5">
                  {selectedEvent.status?.toLowerCase() !== 'bloqueado' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <label className={labelCls}>Nome</label>
                        <input type="text" className={inputCls} value={editFormData.nome_cliente} onChange={e => { setDigitaEdit(true); setEditFormData({...editFormData, nome_cliente: e.target.value})}} />
                      </div>
                      <div>
                        <label className={labelCls}>WhatsApp</label>
                        <input type="text" className={inputCls} value={editFormData.telefone} onChange={(e) => handleTelefoneChange(e, editFormData, setEditFormData)} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Profissional</label>
                      {isBasicUser ? (
                        <input className={inputCls} value={editFormData.profissional} readOnly />
                      ) : (
                        <select className={inputCls} value={editFormData.profissional} onChange={e => setEditFormData({...editFormData, profissional: e.target.value})}>
                          {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>{selectedEvent.status?.toLowerCase() === 'bloqueado' ? 'Motivo' : 'Serviço'}</label>
                      {selectedEvent.status?.toLowerCase() === 'bloqueado' ? (
                        <input type="text" className={inputCls} value={editFormData.servico} onChange={e => setEditFormData({...editFormData, servico: e.target.value})} />
                      ) : (
                        <select className={inputCls} value={editFormData.servico} onChange={e => setEditFormData({...editFormData, servico: e.target.value})}>
                          {servicos.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className={labelCls}>Data</label>
                      <input type="date" className={inputCls} value={editFormData.data_agendamento} onChange={e => setEditFormData({...editFormData, data_agendamento: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelCls}>Início</label>
                      <input type="time" className={inputCls} value={editFormData.hora_inicio} onChange={e => setEditFormData({...editFormData, hora_inicio: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelCls}>Fim</label>
                      <input type="time" className={inputCls} value={editFormData.hora_fim} onChange={e => setEditFormData({...editFormData, hora_fim: e.target.value})} />
                    </div>
                  </div>

                  {errorEdit && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-medium">
                      {errorEdit}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button type="button" disabled={isUpdating} onClick={() => setIsEditMode(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                      Voltar
                    </button>
                    <button type="button" onClick={handleSalvarEdicao} disabled={isUpdating} className="flex-2 py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                      {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MODAL DE CHECKOUT */}
          {isCheckoutOpen && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                Fechar Conta
              </h3>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1 mb-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Profissional: <strong className="text-zinc-900 dark:text-white">{selectedEvent?.profissional}</strong> ({comissoesMap[selectedEvent?.profissional] || 0}%)
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Repasse gerado: <strong className="text-blue-600 dark:text-blue-400">R$ {(checkoutData.valor_cobrado * ((comissoesMap[selectedEvent?.profissional] || 0) / 100)).toFixed(2)}</strong>
                </p>
              </div>

              <form onSubmit={confirmarCheckout} className="space-y-4">
                <div>
                  <label className={labelCls}>Valor Cobrado (R$)</label>
                  <input type="number" step="0.01" className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-lg font-bold text-emerald-600 dark:text-emerald-400" value={checkoutData.valor_cobrado} onChange={e => setCheckoutData({...checkoutData, valor_cobrado: e.target.value})} required />
                </div>
                <div>
                  <label className={labelCls}>Forma de Pagamento</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['pix', 'cartao', 'dinheiro'].map(forma => (
                      <label key={forma} className={`text-center py-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                        checkoutData.forma_pagamento === forma
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        <input type="radio" name="pagamento" value={forma} checked={checkoutData.forma_pagamento === forma} onChange={e => setCheckoutData({...checkoutData, forma_pagamento: e.target.value})} className="hidden" />
                        {forma === 'pix' ? 'Pix' : forma === 'cartao' ? 'Cartão' : 'Dinheiro'}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsCheckoutOpen(false)} disabled={isUpdating} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                    Voltar
                  </button>
                  <button type="submit" disabled={isUpdating} className="flex-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer">
                    {isUpdating ? 'Processando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* EXCLUSÃO */}
          {isConfirmDeleteOpen && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">Excluir Registro?</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
                Tem certeza que deseja apagar este registro definitivamente?
              </p>

              <div className="flex gap-2">
                <button onClick={() => setIsConfirmDeleteOpen(false)} disabled={isUpdating} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  Cancelar
                </button>
                <button onClick={executarExclusaoTotal} disabled={isUpdating} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer">
                  {isUpdating ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .calendario-container .rbc-time-content {
          overflow-y: visible !important;
          height: auto !important;
          position: relative !important;
          z-index: 1 !important;
          border-top: 1px solid var(--border-color) !important;
        }
        .calendario-container {
          max-height: 75vh;
          overflow: auto !important;
          position: relative;
          background-color: var(--bg-card) !important;
        }
        .calendario-container .rbc-calendar {
          height: auto !important;
          min-height: 600px;
        }
        .calendario-container .rbc-time-header {
          position: sticky !important;
          top: 0;
          z-index: 100 !important;
          background-color: var(--bg-card) !important;
          border-bottom: 1px solid var(--border-color) !important;
        }
        .calendario-container .rbc-time-gutter {
          position: sticky !important;
          left: 0;
          z-index: 80 !important;
          background-color: var(--bg-card) !important;
          border-right: 1px solid var(--border-color) !important;
        }
        .calendario-container .rbc-time-header-gutter {
          position: sticky !important;
          top: 0;
          left: 0;
          z-index: 150 !important;
          background-color: var(--bg-card) !important;
          border-bottom: 1px solid var(--border-color) !important;
          border-right: 1px solid var(--border-color) !important;
        }
        .calendario-container .rbc-allday-cell { display: none !important; }
        .calendario-container .rbc-time-header-content > .rbc-row:nth-child(2) { display: none !important; }
        .calendario-container .rbc-time-header-content { border-left: none !important; }
        .calendario-container .rbc-header {
          background-color: var(--bg-card) !important;
          color: var(--text-strong) !important;
          border-left: 1px solid var(--border-color) !important;
          text-transform: capitalize;
          padding: 10px 0;
          font-size: 0.78rem;
          font-weight: 600;
          border-bottom: none !important;
        }
        .calendario-container .rbc-event {
          overflow: visible !important;
          border-radius: 8px !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
          cursor: pointer;
          margin-right: 4px !important;
          margin-bottom: 2px !important;
          padding: 4px 6px !important;
        }
        .evento-wrapper { position: relative; width: 100%; height: 100%; }
        .evento-texto { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.75rem; font-weight: 600; color: inherit; }
        .evento-tooltip {
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(10px);
          background-color: var(--bg-card); border: 1px solid var(--border-color); box-shadow: var(--shadow-md);
          border-radius: 12px; padding: 12px; width: 210px; z-index: 9999;
          opacity: 0; visibility: hidden; transition: all 0.15s ease-out; pointer-events: none;
        }
        .evento-wrapper:hover .evento-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(-6px); }
        @media (max-width: 768px) { .evento-tooltip { display: none !important; } }
        .calendario-container .rbc-event:hover { z-index: 10 !important; }
        .calendario-container .rbc-calendar { color: var(--text-main) !important; background-color: transparent !important; }
        .calendario-container .rbc-time-view,
        .calendario-container .rbc-month-view,
        .calendario-container .rbc-agenda-view {
          border-color: var(--border-color) !important;
          background-color: var(--bg-main) !important;
          border: none !important;
        }
        .calendario-container .rbc-timeslot-group { border-bottom: 1px solid var(--border-color) !important; min-height: 48px; }
        .calendario-container .rbc-time-gutter .rbc-timeslot-group { border-color: var(--border-color) !important; }
        .calendario-container .rbc-time-gutter .rbc-time-slot { color: var(--text-muted) !important; font-size: 0.72rem; }
        .calendario-container .rbc-day-bg {
          transition: background-color 0.2s;
          border-left: 1px solid var(--border-color) !important;
          background-color: var(--bg-main) !important;
        }
        .calendario-container .rbc-day-bg:hover { background-color: rgba(37, 99, 235, 0.04) !important; }
        .calendario-container .rbc-day-slot .rbc-time-slot { border-top: 1px solid var(--border-color) !important; opacity: 0.45; }
        .calendario-container .rbc-today { background-color: rgba(37, 99, 235, 0.04) !important; }
        .calendario-container .rbc-off-range-bg { background-color: var(--bg-card) !important; }
        .calendario-container .rbc-month-row { border-top: 1px solid var(--border-color) !important; }
        .calendario-container .rbc-date-cell { padding-right: 6px; color: var(--text-main) !important; font-size: 0.75rem; }
        .calendario-container .rbc-toolbar { margin-bottom: 14px; font-size: 0.82rem; }
        .calendario-container .rbc-toolbar .rbc-toolbar-label { font-weight: 700; text-transform: capitalize; color: var(--text-strong); }
        .calendario-container .rbc-toolbar button {
          border-radius: 8px; font-weight: 600; padding: 6px 12px; font-size: 0.75rem;
          color: var(--text-main) !important; border-color: var(--border-color) !important;
          background-color: var(--bg-card) !important; cursor: pointer;
        }
        .calendario-container .rbc-toolbar button.rbc-active {
          background-color: #09090b !important;
          color: #ffffff !important;
          border-color: #09090b !important;
        }
        .dark .calendario-container .rbc-toolbar button.rbc-active {
          background-color: #1d4ed8 !important;
          border-color: #1d4ed8 !important;
        }
        .calendario-container .rbc-toolbar button:hover { background-color: var(--bg-tabs) !important; }
      `}</style>
    </div>
  )
}
