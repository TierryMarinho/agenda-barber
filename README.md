# Agenda Barber

Sistema de agendamentos para barbearias com painel em React, JavaScript e Vite
e atendimento pelo WhatsApp com n8n. O painel permite consultar a agenda e
administrar os cadastros conforme as permissões da conta autenticada.

## Tecnologias

- React e React DOM para os componentes e a interface.
- JavaScript e JSX; HTML de entrada e CSS próprio.
- Tailwind CSS carregado por CDN para classes utilitárias.
- Supabase Auth e PostgreSQL para autenticação e persistência.
- React Big Calendar e Moment para a agenda.
- Recharts para os gráficos administrativos.
- n8n, OpenAI e Evolution API para o atendimento e agendamento pelo WhatsApp.

## Executar localmente

É necessário um Node.js compatível com o Vite 8 e npm.

```bash
npm ci
cp .env.example .env.local
```

Preencha o arquivo `.env.local` com as informações públicas do seu projeto:

```dotenv
VITE_SUPABASE_URL=URL_DO_SEU_PROJETO
VITE_SUPABASE_ANON_KEY=CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Depois execute:

```bash
npm run dev
```

A ausência dessas variáveis mantém o login indisponível. Para acessar o painel,
a conta precisa existir no Supabase Auth e possuir um perfil correspondente em
`public.usuarios`, com as permissões e os vínculos exigidos pelo sistema.

Nunca use uma chave secreta ou `service_role` em variáveis `VITE_*`: elas ficam
acessíveis ao navegador. A autorização de consultas e alterações depende das
políticas RLS do banco.

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # gera o frontend em dist/
npm run preview  # visualiza o build local
npm run lint     # análise estática; pode apontar pendências existentes
```

## Automação pelo WhatsApp

O workflow está em
[`automacoes/n8n/agendamento-whatsapp.json`](automacoes/n8n/agendamento-whatsapp.json).
As etapas de importação, configuração das credenciais e teste estão no
[guia da automação](automacoes/n8n/README.md).

O assistente consulta profissionais e horários no banco e registra os detalhes
escolhidos pelo cliente. A confirmação por uma nova mensagem é processada pela
função do banco, que grava o agendamento e retorna a resposta ao WhatsApp.

## Serviços necessários

O repositório contém o painel e o workflow de automação. A infraestrutura,
as credenciais e o schema do banco não estão incluídos. É necessário um Supabase
compatível previamente configurado, com suas tabelas, regras de acesso e funções.
Importar o workflow não cria essas funções nem instala n8n ou Evolution API.

Algumas telas e integrações adicionais dependem de endpoints externos; sua
presença no código não garante que funcionem em um novo ambiente.

Duplicar o código não duplica o banco. Se forem configuradas as mesmas variáveis
de conexão, esta cópia acessará o mesmo Supabase, sujeita às permissões da conta.

## Uso acadêmico

O código é disponibilizado para consulta técnica do painel e da automação. Para
demonstrar o agendamento completo, use também as evidências de execução e a gravação da aplicação.
Não publique dados de clientes ou credenciais junto ao código.
