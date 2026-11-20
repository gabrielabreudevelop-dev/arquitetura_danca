# Roteiro: backups e restauração verificada

Este roteiro é executado pelo dono do projeto (as contas ficam no nome dele). Ele complementa o `servidor.md`: o Postgres de produção já existe no Coolify (seção 5 do `servidor.md`); aqui os backups dele passam a sair da VPS, diariamente, e a restauração é testada de verdade.

Por que importa: os registros de consentimento são a prova legal (LGPD e política do WhatsApp da Meta). Um backup que nunca foi restaurado não é backup.

Convenções: `<bucket>`, `<endpoint>`, `<chave>` e `<segredo>` são valores da sua conta. Nenhum deles deve ser colocado neste arquivo ou no repositório.

## 1. Criar o bucket fora da VPS

1. Escolha um serviço de armazenamento compatível com S3, de outra empresa que não a da VPS: Cloudflare R2 ou Backblaze B2.
2. Crie um bucket privado (por exemplo `arquitetura-backups`). Não ative acesso público.
3. Crie uma chave de acesso restrita só a esse bucket, com leitura e escrita (no R2: token de API "Object Read & Write" limitado ao bucket; no B2: Application Key limitada ao bucket). Não use a chave mestra da conta.
4. Anote o endpoint S3, a região, o nome do bucket, o ID da chave e o segredo. Guarde o segredo no seu gerenciador de senhas.

Como conferir: com um cliente S3 (por exemplo `aws s3 ls s3://<bucket> --endpoint-url <endpoint>` com a chave nova) a listagem funciona, e a mesma chave não consegue listar outros buckets da conta.

## 2. Cadastrar o destino S3 no Coolify

No Coolify, em Storages (S3 Storages), adicione um destino com endpoint, região, bucket, ID da chave e segredo, e use o botão de validar conexão.

Como conferir: o Coolify mostra o destino como válido ("Validate Connection" com sucesso).

## 3. Agendar o backup diário do Postgres de produção

No recurso `postgres-producao` (Coolify), aba Backups, crie um backup agendado:

| Campo | Valor |
| --- | --- |
| Frequência | diária, às 03:00 (`0 3 * * *`) |
| Fuso horário | `America/Sao_Paulo` (confira nas configurações do servidor no Coolify; se o painel só aceitar UTC, use `0 6 * * *`) |
| Destino | o S3 cadastrado na seção 2 |
| Salvar também na VPS | opcional; o que vale é a cópia no S3 |
| Retenção no S3 | 30 dias (preencha o campo de retenção do destino S3; se o Coolify oferecer retenção por quantidade, use 30 backups) |

Faça o mesmo para homologação só se quiser; produção é o que importa.

Como conferir: use "Backup Now". Em poucos minutos o arquivo aparece no bucket (o Coolify gera um dump no formato custom do `pg_dump`, extensão `.dmp`) e a execução aparece como bem-sucedida no histórico do backup.

## 4. Ativar o alerta de falha

No Coolify, em Notifications, confirme que o canal de e-mail está ativo e que o evento de **falha de backup** está marcado (seção 9 do `servidor.md`).

Como conferir: provoque uma falha de propósito (por exemplo, troque temporariamente o segredo do destino S3 por um inválido, rode "Backup Now" e confirme que o e-mail de falha chega); depois restaure o segredo correto e rode "Backup Now" de novo.

## 5. Restaurar e verificar

Faça isto numa máquina com o repositório, Node 26 e pnpm (`pnpm install`), e com um Postgres **vazio e separado** da produção (pode ser um Postgres local ou um banco novo e descartável). Nunca restaure sobre o banco de produção.

1. Baixe o dump mais recente do bucket (pelo painel do provedor ou com um cliente S3) para um arquivo, por exemplo `ultimo.dmp`.
2. Suba um Postgres vazio e crie um banco: por exemplo `createdb restauracao`. A URL será algo como `postgres://usuario:senha@localhost:5432/restauracao`.
3. Rode, na raiz do repositório:

   ```bash
   ./scripts/restaurar-backup.sh ultimo.dmp postgres://usuario:senha@localhost:5432/restauracao
   ```

   O script roda `pg_restore --no-owner --clean --if-exists` e em seguida o verificador (`pnpm backup:verificar -- <url>`). O verificador não altera o banco; ele confere que:

   - o histórico de migrações do banco tem o mesmo número de migrações da pasta `drizzle/`;
   - os seis tipos de consentimento existem (`termos_uso`, `politica_privacidade`, `whatsapp_servico`, `whatsapp_novidades`, `lista_quem_vai`, `uso_imagem`);
   - os cinco gatilhos de imutabilidade existem, estão ativos e têm a função e o tipo esperados;
   - sondas reais, dentro de uma transação sempre desfeita (com dados de teste descartáveis), provam que `UPDATE`, `DELETE` e `TRUNCATE` nas tabelas de consentimento, e a troca de chave de um tipo, são recusados.

4. Resultado esperado, com código de saída 0:

   ```text
   Restauração verificada: nenhum problema encontrado.
   ```

   Se houver problemas, cada um é impresso numa linha e o código de saída é 1. Não considere o backup válido enquanto isso acontecer.

Observações:

- A versão (principal) do `pg_restore` precisa ser **igual ou maior** que a do servidor que gerou o dump. A produção usa Postgres 17, então use `pg_restore` 17 ou mais novo (`pg_restore --version`). Com versão menor, o `pg_restore` recusa o arquivo.
- O banco de destino deve estar vazio. O `pg_restore` pode imprimir erros não fatais e ainda assim restaurar o essencial; leia as mensagens e confie no resultado do verificador, não na ausência de avisos.
- Dentro da imagem de produção (`dist/verificar-restauracao.js`), o verificador também roda: `node dist/verificar-restauracao.js <url>`. O script `restaurar-backup.sh` usa esse arquivo quando ele existe e, caso contrário, `pnpm backup:verificar`.
- Apague o banco de restauração quando terminar: ele contém dados reais de alunos.

## 6. Repetir antes do M4

O M4 é o marco em que os links de ativação vão para os alunos. Antes dele, repita as seções 3 a 5 com o banco já com dados reais (importados da planilha ou cadastrados), baixando um dump recente. Registre a nova execução na tabela abaixo.

## Registro das restaurações verificadas

| Quando | Data | Tamanho do dump | Tempo de restauração | Resultado |
| --- | --- | --- | --- | --- |
| Primeiro backup agendado em produção (fim do M0) | pendente | pendente | pendente | pendente |
| Antes do M4 | pendente | pendente | pendente | pendente |
