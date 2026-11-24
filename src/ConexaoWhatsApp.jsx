import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const WHATSAPP_CACHE_KEY = 'soultech_whatsapp_status';
const CACHE_DURATION = 2 * 60 * 1000;

const salvarStatusCache = (empresaId, isConnected) => {
  const cache = { empresaId, isConnected, timestamp: Date.now() };
  sessionStorage.setItem(WHATSAPP_CACHE_KEY, JSON.stringify(cache));
};

const lerStatusCache = (empresaId) => {
  try {
    const cached = sessionStorage.getItem(WHATSAPP_CACHE_KEY);
    if (!cached) return null;
    const { empresaId: cachedId, isConnected, timestamp } = JSON.parse(cached);
    if (cachedId !== empresaId) return null;
    const isValid = (Date.now() - timestamp) < CACHE_DURATION;
    return isValid ? isConnected : null;
  } catch {
    return null;
  }
};

export default function ConexaoWhatsApp({ empresaId }) {
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState('Verificando conexão...');
  const [loading, setLoading] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const pollingInterval = useRef(null);

  const BACKEND_API = 'https://api.soultech-ia.com.br';

  useEffect(() => {
    if (empresaId) {
      setInstanceName(`wa_empresa_${empresaId}`);
    }
  }, [empresaId]);

  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (empresaId) {
      const cachedStatus = lerStatusCache(empresaId);

      if (cachedStatus !== null) {
        setIsConnected(cachedStatus);
        setStatus(cachedStatus ? 'WhatsApp Conectado' : 'Pronto para conectar');
      }

      verificarConexao();
    }
  }, [empresaId]);

  const verificarConexao = async () => {
    try {
      const response = await fetch(`${BACKEND_API}/whatsapp/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId }),
      });

      const data = await response.json();

      if (response.ok && data.connectionStatus === 'open') {
        setIsConnected(true);
        setStatus('WhatsApp Conectado');
        setQrCode('');
        salvarStatusCache(empresaId, true);

        try {
          const nomeInstancia = data.instance_name || `wa_empresa_${empresaId}`;
          await supabase.from('empresas').update({ instance_name: nomeInstancia }).eq('id', empresaId);
        } catch (dbError) {
          console.error('Erro no auto-healing do banco:', dbError);
        }

        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      } else {
        setIsConnected(false);
        setStatus('Pronto para conectar');
        salvarStatusCache(empresaId, false);
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setStatus('Pronto para conectar');
      salvarStatusCache(empresaId, false);
    }
  };

  const gerarQRCode = async () => {
    setLoading(true);
    setQrCode('');
    setIsConnected(false);
    setStatus('Solicitando conexão segura ao motor...');

    try {
      const response = await fetch(`${BACKEND_API}/whatsapp/conectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId }),
      });

      const data = await response.json();

      if (response.ok) {
        setQrCode(data.qrcode_base64);
        setStatus('QR Code pronto! Aponte a câmera do celular.');

        try {
          const nomeInstanciaSeguro = data.instance || instanceName;
          await supabase.from('empresas').update({ instance_name: nomeInstanciaSeguro }).eq('id', empresaId);
        } catch (dbError) {
          console.error('Erro ao atualizar Supabase:', dbError);
        }

        pollingInterval.current = setInterval(verificarConexao, 3000);
      } else {
        setStatus(`Erro: ${data.detail || 'Erro ao processar solicitação'}`);
      }
    } catch {
      setStatus('Falha na comunicação com o servidor de atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const resetarInstancia = async () => {
    if (!window.confirm("Isso desconectará o WhatsApp atual e apagará a sessão. Continuar?")) return;

    setLoading(true);
    setStatus('Limpando ambiente no servidor...');

    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    try {
      const response = await fetch(`${BACKEND_API}/whatsapp/resetar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId }),
      });

      if (response.ok) {
        setStatus('Ambiente limpo! Clique em Gerar QR Code.');
        setQrCode('');
        setIsConnected(false);
        salvarStatusCache(empresaId, false);

        try {
          await supabase.from('empresas').update({ instance_name: null }).eq('id', empresaId);
        } catch {}
      } else {
        setStatus('Falha ao tentar resetar.');
      }
    } catch {
      setStatus('Falha de rede ao tentar limpar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-700 dark:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Conexão do WhatsApp
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Instância: <code className="font-mono text-slate-700 dark:text-slate-300">{instanceName}</code>
          </p>
        </div>

        <div className={`p-3.5 rounded-xl border text-xs mb-6 flex items-center justify-between ${
          isConnected
            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          <span className="font-medium">Status da sessão</span>
          <span className="font-semibold">{status}</span>
        </div>

        {qrCode && (
          <div className="text-center mb-6">
            <div className="inline-block bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="max-w-[220px] block"
              />
            </div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-3">
              Aponte a câmera do WhatsApp para escanear
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Verificando conexão automaticamente...
            </p>
          </div>
        )}

        {isConnected && (
          <div className="text-center mb-6 p-5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
              ✓
            </div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              WhatsApp Conectado
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Seu sistema está pronto para responder e agendar clientes.
            </p>
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={gerarQRCode}
            disabled={loading || isConnected}
            className="flex-2 py-2.5 px-4 bg-slate-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : isConnected ? 'Conectado' : qrCode ? 'Atualizar QR Code' : 'Gerar QR Code'}
          </button>

          <button
            onClick={resetarInstancia}
            disabled={loading}
            className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/30 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Resetar
          </button>
        </div>
      </div>
    </div>
  );
}
