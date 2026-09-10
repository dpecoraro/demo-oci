# OCI LVL100 README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um README em português que ensine um iniciante a provisionar e publicar a API Node.js do laboratório no OCI, com explicações, troubleshooting e segurança.

**Architecture:** O `README.md` seguirá a ordem real de dependências: identidade, autenticação, rede, computação, acesso, deploy e operação. Cada etapa terá conceito, local de execução, ação no Console ou comando, explicação e teste de sucesso; o fim terá troubleshooting por camada e limpeza do laboratório.

**Tech Stack:** Markdown, OCI Console, OCI CLI, SSH/OpenSSH, Git, Oracle Linux 9, Node.js, systemd, Nginx, firewalld e SELinux.

**Spec:** `docs/superpowers/specs/2026-09-10-oci-lvl100-readme-design.md`

## Global Constraints

- Escrever para uma pessoa em transição de carreira sem experiência prévia em OCI.
- Explicar cada componente antes de usá-lo e cada comando imediatamente após apresentá-lo.
- Distinguir explicitamente computador local, OCI Console e terminal da VM.
- Não incluir OCIDs, fingerprints, passphrases, tokens, chaves privadas ou o IP público real da demonstração.
- Usar placeholders seguros para todos os identificadores do ambiente do leitor.
- Limitar a policy de recursos ao compartment do laboratório.
- Limitar SSH ao IP do leitor com máscara `/32`.
- Informar que o desenho é educacional e não representa a melhor prática de produção.
- Não criar commit nem fazer push antes da aprovação explícita do usuário.

---

### Task 1: Estrutura pedagógica, arquitetura e glossário

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: requisitos e critérios da especificação.
- Produces: introdução, resultado esperado, arquitetura, pré-requisitos e glossário que as tarefas seguintes reutilizam.

- [ ] **Step 1: Criar o aviso e o resultado esperado**

Abrir o README com:

- título “Laboratório OCI LVL100: API Node.js em uma VM Oracle Linux”;
- aviso de que o material é educacional;
- limitações: uma única VM pública, HTTP sem TLS, administração manual, permissões amplas dentro do compartment e ausência de alta disponibilidade;
- lista concreta dos recursos que serão criados.

- [ ] **Step 2: Desenhar o fluxo da solução**

Adicionar este fluxo e explicar cada salto:

```text
Navegador/cliente
    │ HTTP :80
    ▼
IP público → VNIC → Security List/NSG → firewalld → Nginx
                                                      │ proxy local :3000
                                                      ▼
                                               API Node.js
```

- [ ] **Step 3: Criar o glossário**

Definir, em linguagem simples: tenancy, Identity Domain, usuário, grupo, policy, compartment, API Signing Key, chave SSH, region, availability domain, fault domain, VCN, subnet, route table, Internet Gateway, Security List, NSG, VNIC, IP privado, IP público efêmero, boot volume, shape, image, systemd, Nginx, proxy reverso, firewalld e SELinux.

- [ ] **Step 4: Revisar a ordem de apresentação**

Confirmar que nenhum termo aparece nas instruções antes de ser definido ou ligado ao glossário.

---

### Task 2: Identidade, credenciais e OCI CLI

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: glossário da Task 1.
- Produces: usuário autorizado, grupo, policy e profile do OCI CLI prontos para as etapas de infraestrutura.

- [ ] **Step 1: Documentar a criação do usuário**

Explicar o caminho no Console para criar um usuário no Identity Domain, a finalidade de username/e-mail e quando uma senha de Console é necessária. Incluir troubleshooting para sessão ativa durante reset de senha e propagação de alterações IAM.

- [ ] **Step 2: Explicar as três credenciais**

Adicionar uma tabela comparando:

| Credencial | Serve para | Onde fica a parte privada |
|---|---|---|
| Senha do Console | Login humano no navegador | Gerenciador de senhas do usuário |
| API Signing Key | OCI CLI, SDK e API | `~/.oci`, nunca no Git |
| Chave SSH | Login no sistema operacional da VM | `~/.ssh` ou local seguro, nunca no Git |

- [ ] **Step 3: Documentar grupo e associação**

Explicar a criação de `SEU_GRUPO`, a adição de `SEU_USUARIO` ao grupo e por que policies são concedidas ao grupo, não diretamente ao usuário.

- [ ] **Step 4: Documentar a policy**

Incluir e explicar linha por linha:

```text
Allow group SEU_GRUPO to manage instance-family in compartment SEU_COMPARTMENT
Allow group SEU_GRUPO to read app-catalog-listing in tenancy
Allow group SEU_GRUPO to manage volume-family in compartment SEU_COMPARTMENT
Allow group SEU_GRUPO to manage virtual-network-family in compartment SEU_COMPARTMENT
```

Adicionar como opcional:

```text
Allow group SEU_GRUPO to manage compute-capacity-reports in tenancy
```

Explicar `manage`, cada resource family, o escopo `compartment` e a forma `SEU_DOMINIO/SEU_GRUPO` quando aplicável.

- [ ] **Step 5: Documentar o profile do OCI CLI**

Apresentar:

```bash
oci setup config --profile SEU_PROFILE
export OCI_CLI_PROFILE=SEU_PROFILE
echo "${OCI_CLI_PROFILE:-DEFAULT}"
```

Explicar que o nome do profile diferencia maiúsculas de minúsculas, que a chave pública de API deve ser adicionada em User settings → Tokens and keys → API Keys e que gravar a passphrase no config reduz a proteção local.

- [ ] **Step 6: Adicionar teste e troubleshooting de autenticação**

Usar um teste com placeholders e explicar como interpretar `NotAuthorizedOrNotFound`, endpoint em região errada, profile omitido, fingerprint divergente e API Signing Key não cadastrada.

---

### Task 3: Rede pública e controles de tráfego

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: autorização IAM da Task 2.
- Produces: VCN e subnet com caminho completo de entrada e saída para a futura VM.

- [ ] **Step 1: Documentar VCN e subnet pública**

Explicar CIDRs de laboratório sem sobreposição, diferença entre subnet pública e privada e por que a opção “Prohibit public IP on VNIC” deve ficar desabilitada neste laboratório.

- [ ] **Step 2: Documentar Internet Gateway e rota**

Mostrar a criação de um Internet Gateway e a regra:

```text
Destination CIDR: 0.0.0.0/0
Target type: Internet Gateway
Target: SEU_INTERNET_GATEWAY
```

Explicar que o gateway oferece o caminho e a route table decide quando usá-lo.

- [ ] **Step 3: Documentar a Security List**

Adicionar regras de ingress:

```text
SSH:  Source SEU_IP_PUBLICO/32, TCP, destination port 22
HTTP: Source 0.0.0.0/0, TCP, destination port 80
```

Explicar stateful/stateless, source port versus destination port, egress e por que a porta 3000 não será aberta.

- [ ] **Step 4: Explicar associação da Security List**

Destacar em um aviso que criar a lista não a aplica: ela precisa ser associada à subnet. Comparar brevemente Security List, aplicada à subnet, e NSG, aplicado à VNIC.

- [ ] **Step 5: Criar checklist de rede**

O checklist deve exigir: subnet pública, Internet Gateway ativo, rota `0.0.0.0/0`, egress permitido, Security List associada e ingress 22/80.

---

### Task 4: Criação da VM e explicação dos campos do Console

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: compartment e rede das Tasks 2 e 3.
- Produces: VM Oracle Linux alcançável por SSH e preparada para receber a aplicação.

- [ ] **Step 1: Explicar os campos gerais**

Criar uma tabela para Name, Compartment, Placement, Availability Domain, Fault Domain e Capacity type, incluindo impacto e recomendação para o laboratório.

- [ ] **Step 2: Explicar imagem e shape**

Explicar Oracle Linux 9, diferença entre arquitetura AMD/Intel e Arm, OCPUs, memória, limites de Free Tier e compatibilidade de software.

- [ ] **Step 3: Explicar rede da VM**

Explicar VCN, subnet, VNIC, private IPv4, opção de public IPv4, hostname e NSG. Indicar que o laboratório usa a rede criada na Task 3.

- [ ] **Step 4: Explicar chave SSH e boot volume**

Explicar geração ou envio da chave pública SSH, preservação da chave privada, permissões locais `chmod 600`, tamanho do boot volume, criptografia padrão e impacto de custo.

- [ ] **Step 5: Documentar IP público após a criação**

Explicar o caminho Networking → Attached VNICs → IP administration → Edit → Ephemeral public IP, além da diferença e ciclo de vida do IP reservado.

- [ ] **Step 6: Adicionar validação da VM**

O leitor deverá verificar estado `Running`, username da imagem, IP público e associação da VNIC à subnet/NSG corretos antes de tentar SSH.

---

### Task 5: SSH, Git e execução persistente do Node.js

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: VM e chave SSH da Task 4.
- Produces: código clonado e API ativa em `127.0.0.1:3000` sob systemd.

- [ ] **Step 1: Documentar a conexão SSH**

Apresentar no computador local:

```bash
chmod 600 ~/.ssh/SUA_CHAVE_SSH.key
ssh -i ~/.ssh/SUA_CHAVE_SSH.key opc@SEU_IP_PUBLICO
```

Explicar `chmod`, `-i`, o usuário `opc`, o separador `@`, fingerprint do host e a diferença para o usuário `ubuntu`.

- [ ] **Step 2: Documentar diagnóstico de SSH**

Cobrir timeout, `Connection refused`, `Permission denied (publickey)`, username errado, chave errada, regra 22 ausente e subnet/rota sem Internet Gateway.

- [ ] **Step 3: Instalar Git e Node.js na VM**

Apresentar na VM:

```bash
sudo dnf install -y git nodejs
git --version
node --version
npm --version
```

Explicar `sudo`, `dnf`, `install`, `-y` e os comandos de verificação.

- [ ] **Step 4: Clonar e testar a aplicação**

Apresentar na VM:

```bash
cd /home/opc
git clone https://github.com/dpecoraro/demo-oci.git oci-lvl100
cd /home/opc/oci-lvl100
npm test
PORT=3000 node src/server.js
```

Explicar cada comando, o motivo de não haver `npm install` atualmente e como interromper o teste manual com `Ctrl+C`.

- [ ] **Step 5: Criar o serviço systemd**

Incluir o arquivo `/etc/systemd/system/oci-lvl100.service` completo, explicar `[Unit]`, `[Service]`, `[Install]`, `User`, `WorkingDirectory`, `Environment`, `ExecStart` e `Restart`, e executar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now oci-lvl100
sudo systemctl status oci-lvl100 --no-pager -l
curl http://127.0.0.1:3000/health
```

Explicar cada comando e o resultado esperado `{"status":"ok"}`.

---

### Task 6: Nginx, firewall, SELinux e publicação

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: API ativa na porta 3000 da Task 5 e rede com porta 80 da Task 3.
- Produces: página e health endpoint acessíveis pelo IP público na porta 80.

- [ ] **Step 1: Instalar Nginx**

Apresentar e explicar:

```bash
sudo dnf install -y nginx
sudo systemctl enable --now nginx
```

- [ ] **Step 2: Criar a configuração de proxy reverso**

Incluir `/etc/nginx/conf.d/oci-lvl100.conf` completo com `listen 80`, `server_name _`, `proxy_pass http://127.0.0.1:3000` e headers `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto`. Explicar por que Node permanece local e Nginx é a entrada pública.

- [ ] **Step 3: Configurar SELinux e firewalld**

Apresentar e explicar:

```bash
sudo setsebool -P httpd_can_network_relay on
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
sudo nginx -t
sudo systemctl reload nginx
```

Explicar o relay Nginx → Node, persistência com `-P`, serviço HTTP no firewalld, teste de sintaxe e reload sem interromper conexões.

- [ ] **Step 4: Validar cada fronteira**

Na VM:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1/
sudo ss -ltnp | grep -E ':80|:3000'
```

No computador local:

```bash
curl http://SEU_IP_PUBLICO/health
curl http://SEU_IP_PUBLICO/
```

Explicar o resultado esperado de cada teste.

---

### Task 7: Operação, troubleshooting e limpeza

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: solução completa das Tasks 1–6.
- Produces: procedimentos de atualização, diagnóstico e remoção segura do laboratório.

- [ ] **Step 1: Documentar atualização da aplicação**

Apresentar na VM:

```bash
cd /home/opc/oci-lvl100
git pull --ff-only
npm test
sudo systemctl restart oci-lvl100
sudo systemctl status oci-lvl100 --no-pager -l
```

Explicar atualização fast-forward, teste antes do restart e verificação posterior.

- [ ] **Step 2: Criar matriz de troubleshooting**

Incluir sintomas, causas prováveis, comandos de evidência e correções para:

- `NotAuthorizedOrNotFound` no OCI CLI;
- profile ou região incorretos;
- ausência de IP público;
- timeout de SSH/HTTP;
- `Permission denied (publickey)`;
- Git sem acesso à internet;
- Node ou npm ausentes;
- serviço systemd em `failed`;
- Nginx com `502 Bad Gateway`;
- `Permission denied` no error log do Nginx por SELinux;
- firewall local sem `http`;
- Security List criada, mas não associada à subnet.

- [ ] **Step 3: Documentar comandos de diagnóstico**

Explicar:

```bash
sudo journalctl -u oci-lvl100 -n 50 --no-pager
sudo tail -n 50 /var/log/nginx/error.log
getenforce
getsebool httpd_can_network_relay
sudo firewall-cmd --list-all
sudo ss -ltnp
```

- [ ] **Step 4: Documentar limpeza e custos**

Explicar a ordem segura: encerrar a VM, confirmar exclusão do boot volume quando desejado, remover IP reservado, volumes adicionais, gateways e recursos de rede não reutilizados. Diferenciar IP efêmero, removido com a VM, de IP reservado, que continua existindo.

---

### Task 8: Revisão crítica, auditoria de segurança e entrega

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: README completo das Tasks 1–7.
- Produces: documento revisado e pronto para aprovação, ainda sem commit ou push.

- [ ] **Step 1: Fazer leitura como iniciante**

Para cada seção, responder criticamente:

- O leitor sabe onde executar esta ação?
- O componente já foi explicado?
- O comando informa o que altera?
- Existe resultado esperado?
- Existe caminho de recuperação se falhar?
- Há salto implícito que exige conhecimento não ensinado?

Corrigir imediatamente qualquer resposta negativa.

- [ ] **Step 2: Verificar cobertura dos requisitos**

Comparar o README item a item com `docs/superpowers/specs/2026-09-10-oci-lvl100-readme-design.md` e registrar no relatório final que todos os critérios foram verificados ou listar lacunas restantes.

- [ ] **Step 3: Auditar dados sensíveis**

Executar buscas no README por padrões de risco:

```bash
rg -n 'ocid1\.|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|pass_phrase|security_token' README.md
rg -n '/Users/[^/]+' README.md
rg -n '/home/' README.md | rg -v '/home/opc'
```

Todos os comandos devem retornar vazios. Qualquer caminho pessoal deve ser substituído por placeholder. A URL pública do repositório GitHub é permitida porque é necessária para o clone e não contém credencial.

- [ ] **Step 4: Verificar links, comandos e aplicação**

Executar:

```bash
npm test
git diff --check
git status --short
```

Confirmar testes passando, ausência de erros de whitespace e somente os arquivos de documentação esperados modificados ou criados.

- [ ] **Step 5: Entregar para aprovação**

Fornecer o caminho absoluto clicável de `README.md`, resumo da revisão crítica, resultado da auditoria de dados sensíveis e lista de arquivos alterados. Não executar `git add`, `git commit` ou `git push` até o usuário aprovar explicitamente o README.
