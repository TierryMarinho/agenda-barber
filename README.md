# Agenda Barber

Frontend de um sistema de agendamentos para barbearias, desenvolvido com React,
JavaScript e Vite. O painel permite consultar a agenda e administrar os cadastros
conforme as permissões da conta autenticada.

## Tecnologias

- React e React DOM para os componentes e a interface.
- JavaScript e JSX; HTML de entrada e CSS próprio.
- Tailwind CSS carregado por CDN para classes utilitárias.
- Supabase Auth e PostgreSQL para autenticação e persistência.
- React Big Calendar e Moment para a agenda.
- Recharts para os gráficos administrativos.

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

## Escopo desta cópia

Este repositório contém somente o frontend. A infraestrutura, o banco e seu schema,
as migrations, os workflows do n8n, o Spec Kit, as instruções internas dos agentes,
as credenciais e o histórico do repositório de desenvolvimento não são incluídos.
O banco não é criado automaticamente por esta cópia; é necessário um ambiente
compatível previamente configurado, incluindo as tabelas e regras de acesso.

A automação de agendamento por WhatsApp do projeto completo é executada em um
ambiente separado, com n8n, OpenAI e Evolution API. Importar este frontend não
instala ou publica essa automação. Algumas telas e integrações adicionais dependem
desses serviços e de endpoints externos; sua presença no código não garante que
funcionem em um novo ambiente.

Duplicar o código não duplica o banco. Se forem configuradas as mesmas variáveis
de conexão, esta cópia acessará o mesmo Supabase, sujeita às permissões da conta.

## Uso acadêmico

O código é disponibilizado para consulta técnica do frontend. Para demonstrar o
agendamento completo, use também as evidências de execução e a gravação da aplicação.
Não publique dados de clientes ou credenciais junto ao código.
