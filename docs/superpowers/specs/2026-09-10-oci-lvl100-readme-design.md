# Design do README do laboratório OCI LVL100

## Objetivo

Criar um guia em português que permita a uma pessoa iniciante reproduzir, entender, diagnosticar e remover um laboratório no OCI composto por identidade, rede, uma VM Oracle Linux e uma API Node.js publicada por Nginx.

## Público-alvo

Pessoa em transição de carreira, com familiaridade básica com terminal, mas sem experiência prévia com OCI, IAM, redes em nuvem, Linux ou proxies reversos.

## Resultado do laboratório

Ao final, o leitor terá:

- um usuário OCI membro de um grupo;
- uma policy de laboratório limitada a um compartment;
- um profile local do OCI CLI autenticado com API Signing Key;
- uma VCN com subnet pública, Internet Gateway, rota e Security List;
- uma VM Oracle Linux com VNIC e IP público;
- acesso SSH por chave;
- a aplicação `demo-oci` clonada do GitHub;
- Node.js executado como serviço systemd na porta 3000;
- Nginx publicado na porta 80 e encaminhando requisições para o Node;
- a permissão SELinux de relay habilitada quando necessária.

## Estrutura do README

1. Aviso de laboratório e limitações de produção.
2. Arquitetura e fluxo de requisição.
3. Glossário de todos os componentes.
4. Pré-requisitos e mapa das três credenciais.
5. Criação de usuário, grupo, associação e policy.
6. Configuração do OCI CLI e API Signing Key.
7. Criação da rede pública e explicação de cada recurso.
8. Criação da VM e explicação dos campos não avançados do Console.
9. Associação do IP público e configuração da Security List.
10. Conexão SSH.
11. Clone da aplicação e instalação de Node.js e Nginx.
12. Serviço systemd e proxy reverso entre as portas 80 e 3000.
13. Firewall do Oracle Linux e SELinux relay.
14. Validação ponta a ponta.
15. Atualização da aplicação.
16. Troubleshooting por camada.
17. Segurança, limitações e limpeza para evitar custos.

## Regras de conteúdo

- Explicar a finalidade antes de cada comando.
- Explicar opções e argumentos em linguagem simples logo após o comando.
- Usar placeholders seguros como `SEU_IP_PUBLICO`, `SUA_CHAVE_SSH.key`, `SEU_COMPARTMENT` e `SEU_GRUPO`.
- Usar `demo-oci` apenas como exemplo didático de nome, nunca como identificador secreto.
- Usar a URL pública `https://github.com/dpecoraro/demo-oci.git` para o clone.
- Não incluir OCIDs, fingerprints, passphrases, tokens, conteúdo de chaves privadas ou o IP real usado durante a demonstração.
- Não instruir abertura de SSH para `0.0.0.0/0`; usar o IP do aluno com máscara `/32`.
- Explicar que HTTP na porta 80, IP público direto e VM pública são simplificações de laboratório, não uma arquitetura recomendada de produção.
- Não realizar commit nem push do README antes da aprovação explícita do usuário.

## Policy do laboratório

O README mostrará uma policy aplicada a um grupo e limitada a um compartment, cobrindo:

- `manage instance-family` para VMs e recursos associados;
- `read app-catalog-listing in tenancy` para imagens do catálogo;
- `manage volume-family` para boot volumes, block volumes e anexos;
- `manage virtual-network-family` para VCN, subnet, VNIC, Security List, NSG, rotas e gateways;
- `manage compute-capacity-reports in tenancy` como permissão opcional, identificada como tal.

Também explicará a sintaxe `dominio/grupo` para grupos fora do Default Identity Domain.

## Critérios de aceitação

- Todos os itens solicitados aparecem no README em ordem reproduzível.
- Cada componente é definido antes de ser usado.
- Cada comando tem contexto, local de execução e explicação.
- O guia separa claramente comandos executados no computador local e na VM.
- Há testes de verificação ao final de cada camada relevante.
- O troubleshooting cobre sintomas de IAM, OCI CLI, SSH, rede, Git, Node, systemd, Nginx, firewall e SELinux.
- O documento passa por revisão crítica de clareza para iniciantes.
- A auditoria não encontra dado sensível real.
- Os testes existentes da API continuam passando.
