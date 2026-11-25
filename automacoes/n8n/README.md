# Agendamento pelo WhatsApp

O arquivo [agendamento-whatsapp.json](agendamento-whatsapp.json) contém o workflow
exportado do atendimento: recebimento da mensagem pela Evolution API, validação,
consulta ao Supabase, atendimento com OpenAI e envio da resposta ao WhatsApp.

A exportação foi preparada sem vínculos com credenciais, dados de execução ou
identificadores da instalação original. O workflow é importado desativado.

## Dependências

- n8n com os nós HTTP Request, Code, If, Webhook, AI Agent, OpenAI Chat Model e
  Simple Memory. A instalação usada na demonstração foi a versão 2.43.7.
- Evolution API com uma instância de WhatsApp conectada.
- Credencial OpenAI com acesso ao modelo configurado no workflow.
- Supabase com as tabelas `empresas`, `clientes` e `profissionais`, além da função
  `public.whatsapp_agenda_mvp` e suas dependências no banco.

O SQL dessa função e o schema não acompanham esta exportação. Sem eles, as
consultas e a confirmação não funcionam apenas com a importação do JSON.

## Configuração

1. Importe `agendamento-whatsapp.json` no n8n pela opção de importar arquivo.
2. Substitua `https://SEU-PROJETO.supabase.co` nas URLs dos nós HTTP pelo endereço
   do Supabase utilizado. Preserve os caminhos `/rest/v1/...`.
3. No código do nó **Validar mensagem**, substitua todas as ocorrências de
   `00000000-0000-0000-0000-000000000000` pelo UUID da empresa cadastrada. O nome
   `wa_empresa_<UUID>` deve ser idêntico ao da instância conectada na Evolution.
4. No nó **Enviar WhatsApp**, substitua `https://evolution.seu-dominio.com.br` pelo
   endereço da sua Evolution API, preservando a expressão e o caminho de envio.
5. Cadastre e selecione as credenciais abaixo diretamente no n8n.

| Nós | Tipo de credencial | Configuração |
| --- | --- | --- |
| Receber WhatsApp | Header Auth | Name: `X-Agenda-Webhook`; Value: um segredo próprio para o webhook. |
| Consultar empresa, Consultar bloqueio do cliente, Consultar profissionais, Processar mensagem, Consultar horarios, Conferir agendamento e Finalizar resposta | Supabase API | Host e chave de servidor autorizada a consultar as tabelas e executar a função. |
| OpenAI Chat Model | OpenAI API | Chave de API cadastrada na credencial. |
| Enviar WhatsApp | Header Auth | Name: `apikey`; Value: a chave autorizada para a instância na Evolution. |

Os segredos de entrada do webhook e de acesso à Evolution têm finalidades
diferentes. Chaves de servidor ficam nas credenciais do n8n; nunca no frontend,
no arquivo JSON ou no repositório.

## Teste e publicação

1. No nó **Receber WhatsApp**, copie a **Test URL** e clique em **Listen for test
   event**.
2. Na instância da Evolution, ative o webhook e informe essa URL. Ative somente o
   evento `MESSAGES_UPSERT`; mantenha Webhook por Eventos e Base64 desativados.
   Configure o cabeçalho `X-Agenda-Webhook` com o mesmo valor da credencial de
   entrada do n8n.
3. De outro número, envie uma mensagem de texto ao WhatsApp conectado. Escolha
   serviço, profissional, dia e horário disponíveis, e informe o nome do cliente.
4. Confira o resumo e envie uma nova mensagem: **sim** ou **confirmar**. Verifique
   o registro no banco e no painel antes de considerar o teste concluído.
5. Para uso contínuo, publique/ative o workflow e troque a URL na Evolution pela
   **Production URL** do nó. O caminho de produção é
   `/webhook/agendamento-whatsapp`, sem `webhook-test`.

O assistente usa o fuso `America/Sao_Paulo`. A memória da conversa é volátil;
reiniciar o n8n pode apagar esse contexto. A gravação e o tratamento da confirmação
são responsabilidade da função do banco. O workflow não pede código ao cliente.
