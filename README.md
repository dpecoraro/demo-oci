# Laboratório OCI LVL100: API Node.js em uma VM Oracle Linux

Este guia mostra, do zero, como criar um pequeno ambiente no Oracle Cloud Infrastructure (OCI), publicar esta API Node.js em uma VM Oracle Linux e acessá-la pelo navegador.

Ele foi escrito para quem está começando em cloud ou está em transição de carreira. Cada etapa explica **o que** será criado, **por que** existe e **onde** executar a ação.

> [!WARNING]
> Este é um laboratório educacional, não uma arquitetura de produção. Ele usa uma única VM pública, HTTP sem TLS/HTTPS, administração manual e permissões amplas dentro de um compartment. Em produção, prefira princípio do menor privilégio, subnets privadas, Bastion/VPN, HTTPS, gerenciamento de segredos, observabilidade, backup e alta disponibilidade.

## Resultado esperado

Ao terminar, você terá:

- Um usuário OCI dentro de um grupo com permissões de laboratório.
- Um profile local do OCI CLI.
- Uma VCN, subnet pública, Internet Gateway, rota e Security List.
- Uma VM Oracle Linux com VNIC e IP público.
- A API deste repositório rodando como serviço na porta `3000`.
- Nginx recebendo HTTP na porta `80` e encaminhando a requisição para a API.

<img width="681" height="404" alt="image" src="https://github.com/user-attachments/assets/5fe25bad-7e9f-46b9-a71f-789d94bfcb10" />


## Antes de começar

Você precisa de:

- Uma conta OCI ou acesso a uma tenancy de laboratório.
- Permissão para criar usuários, grupos, policies, rede e Compute — ou uma pessoa administradora para fazer essas etapas.
- Um computador com terminal, Git e SSH. Este guia usa macOS/Linux; no Windows, use PowerShell ou WSL.
- A URL pública deste repositório: `https://github.com/dpecoraro/demo-oci.git`.

### Mapa das credenciais

Há três credenciais diferentes neste laboratório. Não as misture.

| Credencial | Serve para | Onde fica a parte privada | Nunca faça |
|---|---|---|---|
| Senha do Console | Entrar no site do OCI como pessoa | Gerenciador de senhas | Compartilhar ou registrar no Git |
| API Signing Key | Autenticar OCI CLI, SDKs e APIs | `~/.oci` no computador local | Usá-la para SSH ou publicar no Git |
| Chave SSH | Entrar no sistema operacional da VM | `~/.ssh` ou diretório seguro | Enviar a chave privada para outra pessoa |

> [!IMPORTANT]
> A API Signing Key **não é** a chave SSH da VM. A primeira autentica chamadas à API do OCI; a segunda autentica o acesso ao Linux. A documentação da Oracle também faz essa distinção: [API Signing Key](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm).

## Glossário rápido

| Termo | O que é | Para que serve aqui |
|---|---|---|
| Tenancy | A conta principal do OCI da organização | Agrupa todos os recursos e identidades |
| Identity Domain | Área de identidades dentro da tenancy | Onde usuários e grupos vivem |
| Usuário | Identidade de uma pessoa ou automação | Representa quem executa ações |
| Grupo | Conjunto de usuários | Recebe permissões por policy |
| Policy | Regra de autorização do OCI | Diz o que um grupo pode fazer |
| Compartment | Pasta lógica de recursos | Limita e organiza o laboratório |
| VCN | Rede virtual privada no OCI | É a rede da VM |
| Subnet | Faixa menor dentro da VCN | Define onde a VNIC recebe IP |
| VNIC | Interface de rede virtual da VM | Liga a VM à subnet e aos IPs |
| Security List | Firewall aplicado à subnet | Libera SSH e HTTP para as VNICs daquela subnet |
| NSG | Firewall aplicado diretamente à VNIC | Alternativa mais específica à Security List |
| Route Table | Tabela de caminhos de rede | Diz para onde vai o tráfego fora da VCN |
| Internet Gateway | Saída/entrada da VCN para a internet | Permite acesso público quando combinado com rota e regras |
| IP público efêmero | IP público temporário do OCI | Permite SSH e HTTP no laboratório |
| Shape | Tamanho e arquitetura da VM | Define CPU, memória e compatibilidade |
| Image | Sistema operacional inicial da VM | Usaremos Oracle Linux 9 |
| Boot volume | Disco principal da VM | Guarda o sistema operacional e arquivos |
| systemd | Gerenciador de serviços do Linux | Mantém a API Node ativa após logout/reboot |
| Nginx | Servidor web/proxy reverso | Recebe HTTP na porta 80 |
| Proxy reverso | Serviço que encaminha requisições | Nginx envia tráfego para Node na porta 3000 |
| firewalld | Firewall do próprio Oracle Linux | Libera HTTP dentro da VM |
| SELinux | Camada extra de segurança do Linux | Pode bloquear o Nginx ao falar com o Node |

---

# Parte 1 — Identidade e permissões

## 1. Criar um usuário

**Onde:** OCI Console.

No menu principal, abra **Identity & Security → Domains**, escolha o seu domínio e abra **Users**. Clique em **Create user**.

Preencha:

- **First name / Last name:** nome identificável para o laboratório.
- **Username:** nome de login único. Evite espaços.
- **Email:** endereço que receberá instruções de acesso, se a tenancy estiver configurada para isso.

Se o usuário precisar entrar no Console, crie ou redefina a senha pelo fluxo de credenciais do usuário. Se aparecer a mensagem de que outra sessão está ativa, saia das demais sessões do Console, feche as abas e tente novamente depois de alguns minutos.

## 2. Criar um grupo e adicionar o usuário

**Por que:** no OCI, policies são associadas a grupos. O usuário herda as permissões por ser membro do grupo.

**Onde:** OCI Console, no mesmo Identity Domain.

1. Abra **Groups** e clique em **Create group**.
2. Crie um grupo chamado, por exemplo, `SEU_GRUPO`.
3. Abra o grupo, entre em **Members** e adicione `SEU_USUARIO`.

Espere alguns segundos após alterar grupos ou policies. Permissões podem levar um curto período para propagar.

## 3. Criar a policy do laboratório

**Por que:** esta policy permite criar e administrar os recursos usados no laboratório, mas limita os recursos ao seu compartment.

**Onde:** OCI Console → **Identity & Security → Policies → Create policy**.

Defina um nome claro, como `laboratorio-compute-policy`, selecione o compartment onde a policy será criada e abra o editor manual. Use as linhas abaixo, trocando os placeholders:

```text
Allow group SEU_GRUPO to manage instance-family in compartment SEU_COMPARTMENT
Allow group SEU_GRUPO to read app-catalog-listing in tenancy
Allow group SEU_GRUPO to manage volume-family in compartment SEU_COMPARTMENT
Allow group SEU_GRUPO to manage virtual-network-family in compartment SEU_COMPARTMENT
```

O que cada linha libera:

| Linha | Finalidade |
|---|---|
| `instance-family` | Criar, iniciar, parar e remover VMs, imagens e anexos relacionados |
| `app-catalog-listing` | Ler o catálogo de imagens disponibilizadas pela Oracle |
| `volume-family` | Criar e administrar boot volumes, block volumes, backups e anexos |
| `virtual-network-family` | Criar/administrar VCN, subnet, VNIC, Security List, NSG, route table e gateways |

Opcionalmente, para consultar disponibilidade de shapes antes de criar uma VM:

```text
Allow group SEU_GRUPO to manage compute-capacity-reports in tenancy
```

`manage` é o verbo mais amplo: permite criar, alterar, consultar e remover dentro do escopo indicado. Para um laboratório ele simplifica; em produção, quebre essa policy em permissões menores.

> [!NOTE]
> Em algumas tenancies com Identity Domains, o grupo pode precisar ser escrito como `SEU_DOMINIO/SEU_GRUPO`. Use o nome exibido pelo Console para o domínio.

## 4. Configurar o OCI CLI com API Signing Key

**Onde:** computador local.

O OCI CLI permite executar ações no OCI pelo terminal. Instale-o seguindo a [documentação oficial](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm) se o comando `oci --version` ainda não existir.

Execute o assistente e crie um profile com nome explícito:

```bash
oci setup config --profile SEU_PROFILE
```

Explicação:

- `oci setup config` abre um assistente para coletar region, User OCID, Tenancy OCID e chave de assinatura.
- `--profile SEU_PROFILE` salva outra configuração sem substituir o profile `DEFAULT` existente.
- O nome do profile diferencia maiúsculas e minúsculas. `DEMO` e `demo` são nomes diferentes.

O assistente pode gerar uma API Signing Key. Quando terminar, no Console abra **Profile menu → User settings → Tokens and keys → API Keys → Add API Key** e envie ou cole a **chave pública** gerada. A chave privada fica apenas no seu computador.

Para usar o profile nesta janela do terminal:

```bash
export OCI_CLI_PROFILE=SEU_PROFILE
echo "${OCI_CLI_PROFILE:-DEFAULT}"
```

Explicação:

- `export OCI_CLI_PROFILE=SEU_PROFILE` seleciona o profile para os próximos comandos daquela janela.
- `echo "${OCI_CLI_PROFILE:-DEFAULT}"` mostra o profile ativo; se a variável não existir, mostra `DEFAULT`.

Teste a assinatura e o profile:

```bash
oci iam region list --profile SEU_PROFILE --output table
```

Explicação:

- `iam region list` faz uma chamada autenticada ao OCI.
- `--profile` evita usar outro profile por engano.
- `--output table` mostra a resposta em tabela.

Se receber `NotAuthorizedOrNotFound`, confira primeiro: profile, região, User OCID, Tenancy OCID, fingerprint da chave pública cadastrada e associação do usuário ao grupo.

> [!CAUTION]
> O assistente pode oferecer gravar a passphrase da API Signing Key no arquivo de configuração. Isso é prático, mas reduz a proteção local porque a passphrase fica armazenada em texto. Para aprendizado, entenda a troca entre praticidade e segurança antes de aceitar.

---

# Parte 2 — Rede pública do laboratório

## 5. Criar uma VCN e uma subnet pública

**Onde:** OCI Console → **Networking → Virtual Cloud Networks**.

Crie uma VCN, por exemplo `SUA_VCN`, com um CIDR privado que não conflite com redes que você já usa. Um exemplo didático é `10.0.0.0/16`.

Depois crie uma subnet, por exemplo `SUA_SUBNET_PUBLICA`, com CIDR `10.0.1.0/24`.

- **VCN CIDR:** tamanho total da rede virtual. `/16` comporta muitas subnets; é grande para o laboratório, mas simples de visualizar.
- **Subnet CIDR:** bloco menor dentro da VCN. `/24` oferece até 256 endereços, incluindo reservas do serviço.
- **Public subnet:** subnet que permite VNICs com IP público, desde que a opção de proibição não esteja habilitada.
- **Prohibit public IP on VNIC:** deixe desabilitado neste laboratório. Se estiver habilitado, a subnet é privada e a VNIC não pode receber IP público.

## 6. Criar Internet Gateway e route rule

**Por que:** um IP público sozinho não cria um caminho até a internet. A VCN precisa de um Internet Gateway e a subnet precisa de uma rota apontando para ele.

**Onde:** dentro da VCN, abra **Gateways → Internet Gateways → Create Internet Gateway**.

Depois, abra **Route Tables**, selecione a route table usada pela subnet e adicione:

```text
Destination CIDR: 0.0.0.0/0
Target type: Internet Gateway
Target: SEU_INTERNET_GATEWAY
```

Explicação:

- `0.0.0.0/0` representa qualquer endereço IPv4 fora das rotas mais específicas.
- **Internet Gateway** é o próximo salto para tráfego de/para internet.
- A route table define o caminho; ela não libera portas. As regras de firewall fazem isso.

## 7. Criar e associar uma Security List

**Onde:** dentro da VCN, abra **Security → Security Lists → Create Security List**.

Crie uma Security List, por exemplo `SUA_SECURITY_LIST`, e adicione estas regras de entrada (ingress):

| Uso | Source CIDR | Protocolo | Destination port | Motivo |
|---|---|---|---|---|
| SSH | `SEU_IP_PUBLICO/32` | TCP | `22` | Acesso administrativo somente do seu computador |
| HTTP | `0.0.0.0/0` | TCP | `80` | Permite que navegadores acessem a demonstração |

Como descobrir `SEU_IP_PUBLICO`: pesquise “what is my IP” no navegador. O `/32` significa “somente este endereço IP”. Quando sua internet muda de IP, atualize a regra SSH.

Deixe a egress rule padrão que permite tráfego de saída. A VM precisa baixar pacotes e clonar o repositório.

> [!IMPORTANT]
> Criar a Security List **não basta**. Abra a subnet, encontre **Security Lists** e associe `SUA_SECURITY_LIST` a ela. Security List é aplicada à subnet. Um **NSG** é uma alternativa aplicada diretamente à VNIC; para este laboratório, escolha um modelo e saiba onde a regra está configurada.

Não abra a porta `3000` na Security List. Ela será usada apenas localmente entre Nginx e Node.js.

### Checklist de rede

Antes de criar a VM, confirme:

- [ ] A subnet é pública e permite IP público na VNIC.
- [ ] O Internet Gateway está disponível.
- [ ] A route table da subnet contém `0.0.0.0/0` apontando para o Internet Gateway.
- [ ] A Security List está associada à subnet.
- [ ] A porta 22 aceita apenas `SEU_IP_PUBLICO/32`.
- [ ] A porta 80 aceita HTTP para a demonstração.

---

# Parte 3 — Criar a VM

## 8. Criar uma Compute Instance

**Onde:** OCI Console → **Compute → Instances → Create instance**.

Os campos comuns, fora de **Advanced options**, têm estes significados:

| Campo | O que escolher no laboratório | Por que importa |
|---|---|---|
| Name | `sua-api-vm` | Nome legível da VM no Console |
| Compartment | `SEU_COMPARTMENT` | Define organização e escopo das policies |
| Placement | Região e AD do laboratório | Define onde o hardware está; recursos de uma região não aparecem em outra |
| Availability Domain | Uma AD disponível | Domínio físico/lógico de disponibilidade; uma VM de laboratório usa uma AD |
| Fault Domain | Deixe o padrão | Ajuda a distribuir VMs em cenários com mais de uma instância |
| Capacity type | On-demand | Capacidade normal; preemptible pode ser interrompida pelo provedor |
| Image | Oracle Linux 9 | Sistema operacional usado neste guia |
| Shape | Shape compatível com sua quota | Determina arquitetura, OCPUs e memória |
| OCPUs / Memory | Menor valor adequado ao laboratório | Define desempenho e possível custo |
| Networking | `SUA_VCN` e `SUA_SUBNET_PUBLICA` | Conecta a VM à rede criada antes |
| Primary VNIC | Aceite a interface principal | É a interface que recebe IP privado e público |
| Assign public IPv4 address | Ative, se disponível | Facilita SSH e HTTP no laboratório |
| SSH keys | Cole/envie sua **chave pública** SSH | Autoriza o seu computador a entrar na VM |
| Boot volume | Mantenha o padrão ou ajuste conscientemente | É o disco do sistema operacional; tamanho maior pode aumentar custo |

### Shape e arquitetura

Um shape pode ser baseado em AMD/Intel (`x86_64`) ou Arm (`aarch64`). A escolha afeta a compatibilidade de alguns binários e imagens. Para este projeto, Node.js e Nginx funcionam nas duas arquiteturas quando instalados pelos repositórios da distribuição; ainda assim, confirme a arquitetura antes de copiar binários externos.

Use **View shape details** e confira as quotas. “Always Free” e limites de capacidade variam por região, tenancy e disponibilidade; não presuma que um shape estará disponível.

### Chave SSH da VM

Se ainda não tem uma chave SSH, gere-a no computador local:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sua-chave-oci -C "laboratorio-oci"
```

Explicação:

- `ssh-keygen` cria um par de chaves para SSH.
- `-t ed25519` escolhe um algoritmo moderno e curto.
- `-f ~/.ssh/sua-chave-oci` define o arquivo da chave privada; o comando cria também um arquivo com sufixo `.pub`.
- `-C "laboratorio-oci"` adiciona somente um rótulo para identificar a chave.

Cole o conteúdo do arquivo `.pub` no Console. Guarde o arquivo sem `.pub` em local seguro: ele é a chave privada.

## 9. Associar um IP público após criar a VM

Se a VM subiu sem IP público, faça:

1. Abra a instância e entre em **Networking**.
2. Em **Attached VNICs**, abra a VNIC principal.
3. Abra **IP administration**.
4. No IP privado primário, escolha **Actions → Edit**.
5. Em **Public IP type**, selecione **Ephemeral public IP** e confirme.

Um IP efêmero existe enquanto estiver associado. Um IP reservado pode sobreviver à VM e pode gerar custo/consumo de quota se for esquecido. Para o laboratório, o efêmero é suficiente.

Confirme antes de seguir:

- A VM está com estado **Running**.
- A página da VM mostra o username da imagem. Para Oracle Linux, normalmente é `opc`.
- A VNIC está na subnet pública esperada.
- A VM possui IP público.

---

# Parte 4 — Conectar e instalar a aplicação

## 10. Conectar por SSH

**Onde:** computador local.

Primeiro, restrinja a leitura da chave privada:

```bash
chmod 600 ~/.ssh/sua-chave-oci
```

`chmod 600` permite leitura e escrita apenas para o dono do arquivo. O SSH recusa chaves privadas com permissões muito abertas.

Conecte à VM:

```bash
ssh -i ~/.ssh/sua-chave-oci opc@SEU_IP_PUBLICO
```

Explicação:

- `ssh` inicia uma sessão remota segura.
- `-i ~/.ssh/sua-chave-oci` informa qual chave privada usar.
- `opc` é o usuário padrão de imagens Oracle Linux e compatíveis com RHEL.
- `@SEU_IP_PUBLICO` separa usuário e servidor. Em Ubuntu, o usuário padrão costuma ser `ubuntu`.

Na primeira conexão, confirme o fingerprint do servidor somente se o IP e a VM forem os que você acabou de criar.

## 11. Instalar Git e Node.js

**Onde:** dentro da VM, após conectar por SSH.

```bash
sudo dnf install -y git nodejs nginx
git --version
node --version
npm --version
```

Explicação:

- `sudo` executa o comando com privilégios administrativos.
- `dnf install` instala pacotes no Oracle Linux.
- `-y` confirma automaticamente a instalação.
- `git`, `nodejs` e `nginx` são os pacotes necessários para baixar, executar e publicar a aplicação.
- Os três comandos `--version` confirmam que Git, Node.js e npm estão disponíveis.

## 12. Baixar e testar a aplicação

**Onde:** dentro da VM.

```bash
cd /home/opc
git clone https://github.com/dpecoraro/demo-oci.git oci-lvl100
cd /home/opc/oci-lvl100
npm test
```

Explicação:

- `cd /home/opc` muda para a pasta principal do usuário `opc`.
- `git clone ... oci-lvl100` baixa o repositório e cria a pasta `oci-lvl100`.
- `cd /home/opc/oci-lvl100` entra no projeto.
- `npm test` executa os testes da API antes da publicação.

Este projeto não tem dependências externas hoje, por isso não precisa de `npm install`. Se o `package.json` passar a declarar dependências no futuro, execute `npm install` ou, preferencialmente para um lockfile já existente, `npm ci`.

Faça um teste manual da API:

```bash
PORT=3000 node src/server.js
```

Explicação:

- `PORT=3000` define a porta usada somente para este comando.
- `node src/server.js` inicia a API.

Em outro terminal SSH, use `curl http://127.0.0.1:3000/health`. Depois volte ao processo e pressione `Ctrl+C` para pará-lo. No próximo passo, systemd fará esse trabalho de forma permanente.

## 13. Criar o serviço systemd

**Onde:** dentro da VM.

Crie o arquivo de serviço:

```bash
sudo tee /etc/systemd/system/oci-lvl100.service > /dev/null <<'EOF'
[Unit]
Description=OCI LVL100 Node API
After=network.target

[Service]
User=opc
WorkingDirectory=/home/opc/oci-lvl100
Environment=PORT=3000
ExecStart=/usr/bin/node /home/opc/oci-lvl100/src/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

Explicação:

- `sudo tee` grava o arquivo em uma pasta que exige permissão administrativa.
- `<<'EOF'` inicia o conteúdo do arquivo; a última linha `EOF` encerra esse conteúdo.
- `[Unit]` descreve o serviço e indica que a rede deve estar disponível antes dele.
- `[Service]` define como a aplicação roda: usuário `opc`, pasta do projeto, porta, comando Node e reinício em caso de falha.
- `[Install]` diz ao systemd em qual fase do boot o serviço será ativado.

Ative e valide o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now oci-lvl100
sudo systemctl status oci-lvl100 --no-pager -l
curl http://127.0.0.1:3000/health
```

Explicação:

- `daemon-reload` faz o systemd ler o novo arquivo.
- `enable --now` configura início automático e inicia o serviço agora.
- `status` mostra se o processo Node está ativo; `--no-pager -l` evita tela interativa e corta menos texto.
- O `curl` local deve retornar `{"status":"ok"}`.

---

# Parte 5 — Publicar HTTP com Nginx

## 14. Configurar o proxy reverso entre portas 80 e 3000

O Node.js ficará em `127.0.0.1:3000`, acessível apenas dentro da VM. O Nginx escuta a porta pública `80` e encaminha cada requisição para a API local.

Crie a configuração:

```bash
sudo tee /etc/nginx/conf.d/oci-lvl100.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Explicação:

- `listen 80` faz o Nginx aceitar HTTP.
- `server_name _` atende qualquer nome/IP no laboratório.
- `location /` cobre todas as rotas, como `/` e `/health`.
- `proxy_pass http://127.0.0.1:3000` envia a requisição para o Node na própria VM.
- Os `proxy_set_header` preservam informações úteis sobre host, IP do cliente e protocolo.

## 15. Liberar Nginx no Oracle Linux

**Onde:** dentro da VM.

```bash
sudo setsebool -P httpd_can_network_relay on
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Explicação:

- `setsebool -P httpd_can_network_relay on` permite que o Nginx, sob SELinux, encaminhe tráfego para a API Node local. `-P` torna a alteração persistente após reboot.
- `firewall-cmd --permanent --add-service=http` libera a porta 80 no firewall do Oracle Linux de forma persistente.
- `firewall-cmd --reload` aplica a nova regra.
- `nginx -t` valida a sintaxe da configuração antes de publicá-la.
- `enable --now nginx` inicia Nginx agora e no boot.
- `reload nginx` recarrega a configuração sem encerrar conexões existentes.

> [!NOTE]
> Há dois controles de rede: a Security List/NSG no OCI e o `firewalld` dentro da VM. A porta precisa estar liberada nos dois lugares para acesso externo.

## 16. Validar por camadas

**Na VM:**

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1/
sudo ss -ltnp | grep -E ':80|:3000'
```

Explicação:

- O primeiro comando testa somente a API Node.
- O segundo testa Nginx e a comunicação Nginx → Node.
- `ss` mostra processos escutando nas portas 80 e 3000.

**No computador local:**

```bash
curl http://SEU_IP_PUBLICO/health
curl http://SEU_IP_PUBLICO/
```

O primeiro deve retornar `{"status":"ok"}`. O segundo deve devolver o HTML da API. Você também pode abrir `http://SEU_IP_PUBLICO/` no navegador.

---

# Parte 6 — Atualização e troubleshooting

## 17. Atualizar a aplicação depois de um push aprovado

**Onde:** dentro da VM.

```bash
cd /home/opc/oci-lvl100
git pull --ff-only
npm test
sudo systemctl restart oci-lvl100
sudo systemctl status oci-lvl100 --no-pager -l
```

Explicação:

- `git pull --ff-only` baixa uma atualização apenas se ela puder avançar o histórico sem criar merge automático.
- `npm test` verifica a aplicação antes de reiniciá-la.
- `restart oci-lvl100` reinicia somente a API Node; Nginx não precisa reiniciar se a configuração não mudou.
- `status` confirma que a nova versão está ativa.

## 18. Troubleshooting

| Sintoma | Onde investigar | Causa provável | Próxima ação |
|---|---|---|---|
| `NotAuthorizedOrNotFound` no OCI CLI | Computador local | Profile, região, OCID, API key ou grupo/policy incorretos | Informe `--profile`, confira a região e confirme que a chave pública foi cadastrada |
| A VM não aceita IP público | Console OCI | Subnet privada ou opção de proibição ativa | Use uma subnet pública; desabilite a proibição de IP público na VNIC |
| SSH dá timeout | Console e computador local | Sem Internet Gateway/rota, regra 22 ausente ou IP público errado | Confira VCN, route table, Security List associada e regra `SEU_IP_PUBLICO/32` |
| SSH dá `Permission denied (publickey)` | Computador local | Chave, username ou permissões errados | Use a mesma chave pública cadastrada, `chmod 600` na privada e `opc` para Oracle Linux |
| `git clone` falha na VM | VM | Sem egress, DNS ou rota para internet | Confira egress da Security List, route rule e Internet Gateway |
| `node` ou `npm` não existe | VM | Pacote não instalado | Execute `sudo dnf install -y nodejs` |
| Serviço `oci-lvl100` está `failed` | VM | Caminho, porta, arquivo ou Node incorreto | Execute `sudo journalctl -u oci-lvl100 -n 50 --no-pager` |
| Nginx retorna `502 Bad Gateway` | VM | Node parado, proxy incorreto ou SELinux bloqueando relay | Teste `curl http://127.0.0.1:3000/health`, leia o error log e habilite relay |
| HTTP externo dá timeout | Console e VM | Security List não associada, porta 80 bloqueada ou rota ausente | Confirme associação da lista, regra 80, Internet Gateway, route table e firewalld |
| Nginx mostra `Permission denied` no log | VM | SELinux bloqueando Nginx → Node | Execute `sudo setsebool -P httpd_can_network_relay on` e recarregue Nginx |

Comandos úteis de diagnóstico na VM:

```bash
sudo journalctl -u oci-lvl100 -n 50 --no-pager
sudo tail -n 50 /var/log/nginx/error.log
getenforce
getsebool httpd_can_network_relay
sudo firewall-cmd --list-all
sudo ss -ltnp
```

Explicação:

- `journalctl` mostra logs do serviço Node gerenciado por systemd.
- `tail` mostra as últimas mensagens de erro do Nginx.
- `getenforce` informa se SELinux está em enforcing, permissive ou disabled.
- `getsebool` mostra se o relay está permitido.
- `firewall-cmd --list-all` exibe regras do firewall local.
- `ss -ltnp` lista portas TCP em escuta e processos associados.

## 19. Limpar o laboratório e evitar custos

Quando não precisar mais do ambiente, remova os recursos conscientemente pelo Console:

1. Encerre a VM em **Compute → Instances**.
2. Decida se o boot volume deve ser apagado; mantê-lo preserva dados e pode consumir armazenamento.
3. Remova block volumes, backups ou IPs reservados que não serão reutilizados.
4. Remova Internet Gateway, route tables, Security Lists, subnets e VCN apenas se nenhum outro recurso depender deles.
5. Revise quotas, custos e recursos restantes no compartment.

Um IP público efêmero normalmente desaparece com a associação/VM. Um IP reservado pode continuar existindo após a VM e deve ser revisado manualmente.

## Próximos passos para produção

Depois de entender o laboratório, evolua o desenho:

- Use HTTPS com domínio e certificado.
- Coloque a aplicação em subnet privada e use Bastion, VPN ou Load Balancer.
- Restrinja policies e regras de rede ao mínimo necessário.
- Use NSGs por serviço e segredos fora do repositório.
- Adicione logs, métricas, alertas, backups e atualização automatizada.
- Considere containerização, CI/CD e múltiplas instâncias para alta disponibilidade.

## Referências oficiais

- [Required Keys and OCIDs](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm)
- [Common IAM Policies](https://docs.oracle.com/en-us/iaas/Content/Identity/Concepts/commonpolicies.htm)
- [Internet Gateway](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingIGs.htm)
- [Conectar a uma instância Linux](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm)
- [Nginx no Oracle Linux](https://docs.oracle.com/en-us/iaas/oracle-linux/balancing/balancing-setting-up-load-balancing-by-using-nginx.htm)
