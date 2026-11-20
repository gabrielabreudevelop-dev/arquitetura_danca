# Roteiro: VPS, Coolify, ambientes e monitoramento

Este roteiro é executado pelo dono do projeto, porque as contas (VPS, domínio, Coolify, monitoramento) ficam no nome dele. Siga na ordem. Cada seção termina com um "Como conferir".

Convenções: `<ip>` é o IP público da VPS, `<domínio>` é o domínio de produção e `<usuario>` é o usuário administrativo que você criar. Nenhum segredo ou domínio real deve ser colocado neste arquivo.

Ambientes:

| Ambiente | Branch | URL |
| --- | --- | --- |
| Produção | `main` | `https://<domínio>` |
| Homologação | `homologacao` | `https://homologacao.<domínio>` |

## 1. Contratar a VPS

1. Contrate uma VPS em São Paulo, com no mínimo 2 vCPU e 4 GB de RAM, sistema Ubuntu LTS. Sugestão: Hostinger KVM 2 (2 vCPU, 8 GB).
2. No painel do provedor, anote o IP público (`<ip>`) e, se possível, cadastre sua chave SSH pública na criação do servidor.

Como conferir: `ssh root@<ip>` entra no servidor (neste ponto o root ainda é permitido) e `lsb_release -a` mostra Ubuntu LTS.

## 2. Preparar o servidor (usuário, SSH, firewall, atualizações)

Se ainda não tem chave SSH no seu computador: `ssh-keygen -t ed25519`.

Como root no servidor:

```bash
adduser <usuario>
usermod -aG sudo <usuario>
```

No seu computador, copie a chave para o novo usuário:

```bash
ssh-copy-id <usuario>@<ip>
```

Abra uma segunda sessão e confirme que `ssh <usuario>@<ip>` entra sem pedir a senha do servidor e que `sudo -v` funciona. Só então endureça o SSH. Edite `/etc/ssh/sshd_config` (e confira se arquivos em `/etc/ssh/sshd_config.d/` não sobrescrevem) com:

```text
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo sshd -t && sudo systemctl restart ssh
```

Firewall e atualizações automáticas:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Como conferir: `ssh root@<ip>` é recusado; `ssh <usuario>@<ip>` entra; `sudo ufw status` lista 22, 80 e 443; `systemctl status unattended-upgrades` mostra ativo.

## 3. Instalar o Coolify e proteger o painel

1. Como `<usuario>` (com sudo/root), rode o comando de instalação da documentação oficial do Coolify (coolify.io/docs). Não use comandos de outras fontes.
2. O painel responde inicialmente em `http://<ip>:8000`. Para isso, libere temporariamente a porta: `sudo ufw allow 8000`.
3. Abra o painel e crie imediatamente a conta de administrador, com senha forte e única.
4. Depois que o DNS da seção 4 estiver pronto, configure o domínio do painel nas configurações de instância do Coolify (por exemplo `https://coolify.<domínio>`), para que seja servido com HTTPS pelo próprio Coolify.
5. Com o painel respondendo em HTTPS, feche a porta 8000: `sudo ufw delete allow 8000`.

Aviso sobre Docker e ufw: portas publicadas pelo Docker podem passar por cima das regras do `ufw`. Por isso, nenhum recurso (principalmente os Postgres da seção 5) pode ter porta pública habilitada no Coolify.

Como conferir: `https://coolify.<domínio>` abre com cadeado válido; `curl -sS -m 5 http://<ip>:8000` falha (porta fechada); `sudo ufw status` não lista 8000.

## 4. Apontar o DNS

No provedor do domínio, crie registros do tipo A apontando para `<ip>`:

- `<domínio>` (produção)
- `homologacao.<domínio>`
- `coolify.<domínio>` (painel)

Aguarde a propagação (de minutos a algumas horas).

Como conferir: `dig +short <domínio>`, `dig +short homologacao.<domínio>` e `dig +short coolify.<domínio>` devolvem `<ip>`.

## 5. Criar os dois bancos Postgres 17

No Coolify, no projeto do estúdio, crie dois recursos de banco PostgreSQL 17, um por ambiente (por exemplo `postgres-producao` e `postgres-homologacao`).

- Deixe desligada a opção de tornar o banco público ("Make it publicly available"). Sem porta pública.
- Anote a URL interna de conexão de cada um (formato `postgres://...@<nome-do-recurso>:5432/...`), que será usada como `DATABASE_URL` na seção 7. Ela só funciona dentro da rede do Coolify.
- Ative backups agendados de cada banco (ao menos o de produção), com a retenção que preferir.

Como conferir: no Coolify os dois bancos aparecem como "Running"; nenhum mostra porta pública; `nc -zv <ip> 5432` de fora do servidor não conecta.

## 6. Criar as duas aplicações

No Coolify, conecte o repositório `gabrielabreudevelop-dev/arquitetura_danca` e crie duas aplicações, ambas com build pack **Dockerfile** (o `Dockerfile` está na raiz do repositório; a aplicação escuta na porta 3000):

| Aplicação | Branch | Domínio |
| --- | --- | --- |
| Produção | `main` | `https://<domínio>` |
| Homologação | `homologacao` | `https://homologacao.<domínio>` |

Em cada uma:

- Porta exposta: `3000`.
- Comando de pré-deploy (pre-deployment command): `node dist/migrar.js`. Ele aplica as migrações antes de cada versão subir.
- Health check: caminho `/api/saude`, porta `3000`. Resposta saudável: HTTP 200 com `{"status":"ok","banco":"ok"}` (503 se o banco não responder).
- Ative o deploy automático por push no branch correspondente.
- HTTPS (Let's Encrypt) é emitido pelo Coolify ao salvar o domínio; o DNS da seção 4 precisa estar pronto.

Não faça o primeiro deploy antes de preencher as variáveis da seção 7.

Como conferir: as duas aplicações aparecem no Coolify, cada uma com seu branch e domínio corretos.

## 7. Variáveis de ambiente

Em cada aplicação, defina (valores diferentes por ambiente):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL interna do Postgres do próprio ambiente (seção 5). |
| `BETTER_AUTH_SECRET` | Gerado com `openssl rand -base64 32` (mínimo de 32 caracteres). Gere um valor **diferente** para cada ambiente e guarde em um gerenciador de senhas. |
| `BETTER_AUTH_URL` | URL pública https do ambiente, sem barra final: `https://<domínio>` ou `https://homologacao.<domínio>`. |
| `PROXIES_CONFIAVEIS` | **Deixe vazia ou não crie.** Atrás do Traefik do Coolify, o `X-Forwarded-For` já chega com um único IP de cliente. Só preencha (IPs/CIDRs separados por vírgula) se um dia houver um salto extra na frente, como uma CDN. |

Nunca coloque esses valores no repositório. `DATABASE_URL_TESTE_ADMIN` é só dos testes locais e não existe nos servidores.

Depois de salvar as variáveis, faça o deploy das duas aplicações.

Como conferir: o deploy termina com sucesso (o pre-deploy `node dist/migrar.js` roda sem erro nos logs); `curl -sS https://<domínio>/api/saude` devolve `{"status":"ok","banco":"ok"}`; o mesmo para `https://homologacao.<domínio>/api/saude`.

### Criar o primeiro usuário da equipe

Faça uma vez em cada ambiente, depois do primeiro deploy. No Coolify, abra o terminal do contêiner da aplicação (ou use `docker exec -it <contêiner> sh` no servidor; a opção `-it` é necessária porque o comando pede a senha de forma interativa e exige um TTY):

```bash
node dist/criar-membro-equipe.js --nome "Nome" --email "email@exemplo.com" --papel administracao
```

O comando pergunta a senha no terminal. Não passe a senha como argumento.

Como conferir: o comando termina sem erro e o login da equipe funciona no ambiente correspondente.

## 8. Monitoramento externo

Use um serviço fora da VPS (UptimeRobot ou Better Stack, plano gratuito):

1. Crie um monitor HTTP(S) para `https://<domínio>/api/saude`, intervalo de 5 minutos.
2. Se o serviço permitir, exija o texto `"status":"ok"` na resposta (assim, falha de banco com HTTP 503 também alerta).
3. Configure o alerta por e-mail para o dono do projeto.

Como conferir: o monitor aparece como "Up". Teste o alerta pausando a aplicação de produção no Coolify por alguns minutos e confirme que o e-mail chega; depois reative.

## 9. Notificações do Coolify

Em Notifications, no Coolify, ative o canal de e-mail (SMTP próprio ou o serviço indicado no painel) e marque os eventos de **falha de deploy** e **falha de backup**.

Como conferir: use o botão de teste de notificação do Coolify e confirme o e-mail na caixa de entrada.

## Checklist final de verificação

Rode no seu computador, substituindo `<domínio>` e `<ip>`:

```bash
curl -sS https://<domínio>/api/saude
curl -sS https://homologacao.<domínio>/api/saude
curl -sI http://<domínio>
ssh root@<ip>
```

Resultado esperado:

- [ ] Os dois primeiros devolvem `{"status":"ok","banco":"ok"}`.
- [ ] `curl -sI http://<domínio>` mostra redirecionamento 301 ou 308 com `Location: https://...`.
- [ ] `ssh root@<ip>` é recusado (Permission denied).
- [ ] `sudo ufw status` mostra só 22, 80 e 443 (sem 8000).
- [ ] Nenhum Postgres com porta pública; `nc -zv <ip> 5432` não conecta.
- [ ] Monitor externo em "Up" e alerta de e-mail testado.
- [ ] Notificações do Coolify (deploy e backup) testadas.
