# Briefing do Sistema para Estudar Nova Implementacao de Venda de Passagens

Use o texto abaixo como contexto para outro GPT analisar o sistema atual e propor uma nova implementacao de venda de passagens sem perder o que ja existe.

## Prompt pronto para colar no GPT

```text
Estou trabalhando em um sistema web de operacao de fretes hidroviarios feito em React + Vite + Firebase/Firestore.

Quero que voce leia o contexto abaixo e me ajude a planejar uma nova implementacao de venda de passagens, aproveitando ao maximo a arquitetura e os padroes que ja existem no sistema.

Objetivo do seu trabalho:
1. Entender o sistema atual.
2. Identificar o que pode ser reaproveitado para venda de passagens.
3. Propor o modelo de dados ideal para passagens.
4. Propor telas, fluxos, regras de negocio e integracoes.
5. Sugerir a estrategia de implementacao por fases, com baixo risco.
6. Apontar impactos em caixa, usuarios, embarcacoes, rotas, terminais, comprovantes, QR Code, rastreio/check-in e relatorios.
7. Se fizer sentido, separar os conceitos de frete e passagem, mas mantendo a mesma base administrativa.

Contexto atual do sistema:

NOME DO PROJETO
- Nome: fretes-pwa
- Tipo: PWA/web app operacional
- Stack principal: React 19, Vite, React Router, Firebase Auth, Firestore, jsPDF, qrcode, jsQR
- O sistema hoje e focado em cadastro e operacao de fretes/encomendas.

ARQUITETURA GERAL
- Frontend SPA em React com rotas protegidas.
- Persistencia principal em Firestore.
- Autenticacao via Firebase Auth.
- Existe modo com dados demo/local quando Firebase nao esta configurado.
- O sistema e multiempresa: quase todas as colecoes podem ser filtradas por empresaId e empresaNome.
- Existe perfil de superadmin e usuarios operacionais/admin por empresa.

ROTAS/TELAS ATUAIS
- /login: autenticacao
- /dashboard: resumo operacional
- /nova-comanda: cadastro do frete
- /clientes: cadastro de clientes
- /terminais: cadastro de terminais
- /embarcacoes: cadastro de embarcacoes
- /rotas-valores: cadastro de rotas, terminais e valores
- /encomendas: lista operacional de encomendas
- /rastreio/:codigo: rastreio publico/operacional
- /scanner-retirada: leitura de QR para retirada
- /retirada/:codigo: entrega/retirada com assinatura
- /caixa: financeiro operacional
- /usuarios: gestao de usuarios
- /empresas: gestao de empresas
- /logs-uso: auditoria

FUNCIONALIDADES PRINCIPAIS DO SISTEMA

1. Cadastro de frete/encomenda
- Tela principal: Nova Comanda.
- Coleta remetente, destinatario, linha, embarcacao, horario, terminal, valores e descricao.
- Gera codigo unico de encomenda.
- Gera QR Code.
- Gera URL de rastreio.
- Salva encomenda no Firestore.
- Cria movimentacao inicial.
- Cria lancamento no caixa.
- Gera comprovante PDF de postagem.
- Ao final, abre popup para compartilhar o comprovante por e-mail, WhatsApp ou compartilhamento nativo do celular.

2. Consulta operacional de encomendas
- Tela Encomendas lista registros paginados.
- Busca por codigo ou nome do destinatario.
- Permite atualizar status.
- Permite excluir.
- Permite abrir PDF do comprovante.
- Permite abrir rastreio.
- Permite iniciar fluxo de entrega.

3. Rastreio publico e operacional
- Rota publica /rastreio/:codigo.
- Mostra dados principais da comanda.
- Pode abrir PDF.
- Pode carregar historico sob demanda.
- Se usuario estiver logado, pode dar baixa manual ou abrir retirada com assinatura.

4. Retirada/entrega com assinatura
- Tela de retirada coleta nome, documento, observacao e assinatura em canvas.
- Salva assinatura como data URL.
- Atualiza status para Entregue.
- Gera recibo PDF assinado.
- Existe scanner de QR por camera, foto ou digitacao manual para abrir o fluxo.

5. Caixa
- Registra entradas financeiras ligadas a encomendas.
- Lista lancamentos.
- Filtra por periodo.
- Calcula totais.
- Exporta PDF do caixa.

6. Cadastros administrativos
- Clientes.
- Terminais.
- Embarcacoes com horarios de partida.
- Rotas/linhas com origem, destino, terminais, valor e duracao.
- Empresas.
- Usuarios.

7. Auditoria e governanca
- Logs de uso para login e acoes sensiveis.
- Controle de perfis.
- Multiempresa.

COLECOES / ENTIDADES EXISTENTES

- usuarios
  - nome, email, perfil, ativo, empresaId, empresaNome, uid

- empresas
  - nome, cnpj, responsavel, telefone, email, endereco, observacoes

- clientes
  - nome, telefone, email, documento, cidade, empresaId, empresaNome
  - Hoje clientes sao usados como remetentes e destinatarios.

- terminais
  - nome, cidade, observacao, empresaId, empresaNome

- embarcacoes
  - nome, identificacao, capacidade, horariosPartida, horarioPartidaPadrao, empresaId, empresaNome

- rotasValores
  - origem, destino, terminalOrigem, terminalDestino, valor, duracaoMinutos, empresaId, empresaNome

- encomendas
  - codigo
  - remetenteId, remetenteNome, remetenteTelefone, remetenteEmail, remetenteDocumento
  - destinatarioId, destinatarioNome, destinatarioTelefone, destinatarioEmail
  - rotaId, linhaNome
  - embarcacaoId, embarcacaoNome
  - dataComanda
  - horarioChegada
  - horarioSaidaEmbarcacao
  - previsaoChegada
  - terminalOrigem, terminalDestino
  - tipoMercadoria, descricao, quantidade, peso
  - possuiNotaFiscal, valorDeclarado, valorMercadoria
  - freteCobranca, valorFrete, valorTotal, formaPagamento
  - qrCodeDataUrl, rastreioUrl
  - status
  - operadorNome, operadorEmail
  - entregueEm
  - assinaturaRetiradaDataUrl
  - retiradaRecebedorNome, retiradaRecebedorDocumento, retiradaObservacao
  - modoBaixa
  - empresaId, empresaNome
  - criadoEm, atualizadoEm

- movimentacoes
  - encomendaCodigo, status, descricao, criadoEm, empresaId, empresaNome

- caixa
  - valor, tipo, origem, encomendaCodigo, formaPagamento, criadoEm, empresaId, empresaNome

- logsUso
  - acao, detalhes, usuarioNome, usuarioEmail, perfil, empresaId, empresaNome, criadoEm

FLUXOS IMPORTANTES JA PRONTOS

- Cadastro assistido por rotas e embarcacoes:
  - a linha determina valor padrao e terminais
  - a embarcacao pode sugerir horario de partida
  - o sistema calcula previsao de chegada

- Geração de documentos:
  - comprovante PDF de postagem
  - recibo PDF de retirada/entrega
  - PDF de clientes
  - PDF de caixa

- QR Code:
  - QR e salvo na encomenda
  - QR abre rastreio
  - scanner pode ler camera, imagem ou texto/URL

- Busca e paginacao:
  - varias telas usam carga inicial pequena e busca sob demanda para reduzir custo de leitura no Firestore

- Multiempresa:
  - usuario comum opera dentro da propria empresa
  - superadmin enxerga tudo

PADROES DE IMPLEMENTACAO RELEVANTES

- Existe um CollectionManager generico para CRUD simples.
- Para modulos mais especificos, as telas fazem paginação e busca manualmente.
- O service central e src/services/firebase.js.
- A autenticacao fica em AuthContext.
- A geracao de comprovantes e recibos fica em utils.
- Erros de runtime sao registrados por utilitario proprio.

LIMITES E CUIDADOS DO CENARIO ATUAL

- O sistema atual foi desenhado para encomendas/fretes, nao para assentos de passageiros.
- O conceito de cliente hoje serve para remetente/destinatario, nao necessariamente para passageiro.
- O caixa hoje nasce principalmente da criacao da encomenda.
- O rastreio atual e por codigo de encomenda.
- O QR hoje esta associado ao comprovante da encomenda e ao fluxo de retirada/entrega.
- O status atual da encomenda nao cobre jornada de passageiro.

O QUE EU QUERO QUE VOCE ME ENTREGUE

1. Uma leitura arquitetural do que pode ser reaproveitado para passagens.
2. Um modelo de dados sugerido para passagens, viagens, assentos, reservas, check-in e bilhetes.
3. A explicacao se vale mais:
   - criar um modulo separado de passagens
   - ou adaptar o modulo de encomendas
   - ou criar um nucleo comercial comum e dois produtos: frete e passagem
4. As novas telas recomendadas.
5. As regras de negocio mais importantes.
6. Como encaixar isso em caixa, QR Code, comprovantes e embarcacoes.
7. Como fazer uma implementacao incremental, sem quebrar o frete atual.
8. Se possivel, monte uma proposta por fases:
   - fase 1: estrutura minima
   - fase 2: venda
   - fase 3: embarque/check-in
   - fase 4: relatorios e consolidacao

Quero uma resposta pratica, bem estruturada e com foco em implementacao real.
```

## Resumo tecnico do sistema atual

## 1. O que o sistema e hoje

O sistema atual e uma plataforma operacional para fretes hidroviarios. Ele cobre:

- cadastro de comanda/frete
- gestao de remetente e destinatario
- configuracao de rotas, terminais e embarcacoes
- emissao de comprovante PDF
- rastreio por codigo
- QR Code para consulta e retirada
- baixa com assinatura digital
- caixa operacional
- administracao multiempresa
- gestao de usuarios e auditoria

Em termos de negocio, o centro do sistema hoje e a `encomenda`.

## 2. Tecnologias e organizacao

- Frontend: React 19 + Vite
- Roteamento: `react-router-dom`
- Banco/autenticacao: Firebase Auth + Firestore
- PDFs: `jsPDF`
- QR Code: `qrcode`
- Leitura de QR: `jsqr` e `BarcodeDetector` quando o navegador suporta
- PWA: configuracao via Vite PWA

Arquivos centrais:

- Rotas: [src/routes/AppRoutes.jsx](/C:/Users/ander/projetos/fretes-pwa/src/routes/AppRoutes.jsx:1)
- App principal: [src/App.jsx](/C:/Users/ander/projetos/fretes-pwa/src/App.jsx:1)
- Servicos de dados: [src/services/firebase.js](/C:/Users/ander/projetos/fretes-pwa/src/services/firebase.js:1)
- Contexto de autenticacao: [src/context/AuthContext.jsx](/C:/Users/ander/projetos/fretes-pwa/src/context/AuthContext.jsx:1)
- CRUD generico: [src/components/CollectionManager.jsx](/C:/Users/ander/projetos/fretes-pwa/src/components/CollectionManager.jsx:1)

## 3. Fluxos principais

### 3.1. Criacao de frete

Tela principal: [src/pages/NovaComanda.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/NovaComanda.jsx:1)

O fluxo atual:

1. Operador informa remetente e destinatario.
2. Escolhe embarcacao.
3. Escolhe linha/rota.
4. Sistema sugere horario de saida da embarcacao.
5. Sistema calcula previsao de chegada com base na duracao da rota.
6. Operador informa cobranca, valor, observacoes e dados complementares.
7. Sistema gera codigo unico.
8. Sistema gera QR Code.
9. Sistema salva a encomenda.
10. Sistema cria movimentacao inicial.
11. Sistema registra entrada no caixa.
12. Sistema gera comprovante PDF.
13. Sistema abre popup de compartilhamento do comprovante.

### 3.2. Consulta e operacao sobre encomendas

Tela: [src/pages/Encomendas.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Encomendas.jsx:1)

Permite:

- listar encomendas paginadas
- buscar por codigo ou destinatario
- atualizar status
- excluir registro
- abrir PDF
- abrir rastreio
- iniciar entrega/retirada

### 3.3. Rastreio

Tela: [src/pages/Rastreio.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Rastreio.jsx:1)

Tem uso duplo:

- publico: consulta por codigo
- interno: baixa manual, acesso ao PDF e historico

### 3.4. Retirada/entrega com assinatura

Tela: [src/pages/RetiradaEntrega.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/RetiradaEntrega.jsx:1)

Recursos:

- assinatura em canvas
- registro de nome e documento do recebedor
- atualizacao de status para `Entregue`
- geracao de recibo PDF assinado

### 3.5. Scanner

Tela: [src/pages/ScannerRetirada.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/ScannerRetirada.jsx:1)

Recursos:

- leitura pela camera
- leitura por foto
- leitura via texto/URL manual

### 3.6. Caixa

Tela: [src/pages/Caixa.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Caixa.jsx:1)

Recursos:

- resumo financeiro
- listagem de entradas
- filtro por periodo
- exportacao PDF
- exclusao de lancamentos

## 4. Cadastros estruturantes

### 4.1. Clientes

Tela: [src/pages/Clientes.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Clientes.jsx:1)

Uso atual:

- base de remetentes
- base de destinatarios
- autocomplete na nova comanda

### 4.2. Terminais

Tela: [src/pages/Terminais.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Terminais.jsx:1)

Uso atual:

- pontos de origem e destino
- dependencia para rotas

### 4.3. Embarcacoes

Tela: [src/pages/Embarcacoes.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Embarcacoes.jsx:1)

Uso atual:

- nome, identificacao e capacidade
- horariosPartida
- horarioPartidaPadrao

Observacao importante para passagens:

- embarcacao hoje nao possui mapa de assentos, lotacao por viagem ou classes tarifarias

### 4.4. Rotas e valores

Tela: [src/pages/RotasValores.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/RotasValores.jsx:1)

Uso atual:

- origem
- destino
- terminalOrigem
- terminalDestino
- valor
- duracaoMinutos

Observacao importante para passagens:

- essa estrutura ja pode servir de base para tabela de percurso de passagem, mas hoje foi pensada como valor padrao de frete

### 4.5. Usuarios

Tela: [src/pages/Usuarios.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Usuarios.jsx:1)

Uso atual:

- cria operador ou admin
- vincula usuario a empresa
- controla ativo/inativo

### 4.6. Empresas

Tela: [src/pages/Empresas.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/Empresas.jsx:1)

Uso atual:

- base multiempresa do sistema

### 4.7. Logs

Tela: [src/pages/LogsUso.jsx](/C:/Users/ander/projetos/fretes-pwa/src/pages/LogsUso.jsx:1)

Uso atual:

- auditoria simples de acessos e acoes sensiveis

## 5. Entidades existentes e papel de cada uma

### `encomendas`

Entidade principal do produto atual.

Representa:

- o frete cadastrado
- os dados de origem/destino
- o comprovante logico da operacao
- o estado operacional

### `movimentacoes`

Historico de eventos por encomenda.

Representa:

- alteracoes de status
- observacoes operacionais
- trilha de rastreio

### `caixa`

Lancamentos financeiros.

Representa:

- entradas de valor
- referencia ao codigo da encomenda
- origem do lancamento

### `clientes`

Cadastro base de pessoas/empresas ligadas ao frete.

Hoje representa:

- remetente
- destinatario

Nao representa ainda:

- passageiro
- responsavel pela reserva
- dependente
- manifestante de embarque

## 6. O que ja pode ser reaproveitado para venda de passagens

Pontos fortes reaproveitaveis:

- multiempresa
- usuarios e perfis
- cadastros de terminais
- cadastros de embarcacoes
- cadastros de rotas
- caixa
- geracao de PDF
- geracao e leitura de QR Code
- rastreio/consulta por codigo
- scanner para validacao no balcao
- padrao de busca paginada no Firestore
- auditoria basica

## 7. O que hoje nao existe e provavelmente sera necessario para passagens

### Estrutura comercial

- cadastro de passageiro
- reserva
- bilhete/passagem
- viagem/partida do dia
- assento/poltrona/rede/vaga
- tarifa por categoria
- regras de cancelamento/remarcacao
- status de embarque
- check-in / boarded / no-show

### Estrutura operacional

- manifestacao de passageiros por viagem
- controle de capacidade vendida x capacidade da embarcacao
- fechamento de embarque
- validacao do bilhete no embarque

### Estrutura financeira

- lancamentos de venda de passagem no caixa
- estorno
- taxa de servico
- meio de pagamento por bilhete

## 8. Recomendacao estrutural inicial

Para evoluir com menor risco, a melhor linha parece ser:

- manter `encomendas` como modulo de frete
- criar um modulo novo de `passagens`
- reaproveitar cadastros e servicos comuns
- no futuro, se quiser, extrair um nucleo comercial compartilhado

Em outras palavras:

- nao misturar frete e passagem na mesma colecao principal
- compartilhar somente o que for infraestrutura comum

## 9. Colecoes novas que provavelmente farao sentido

Sugestao inicial:

- `passageiros`
- `viagens`
- `passagens`
- `checkins` ou `embarques`
- `tarifasPassagens`
- `poltronas` ou `mapasEmbarcacao` se houver assento marcado

## 10. Como o sistema atual ajuda no desenho da nova funcionalidade

### Embarcacoes

Ja existem, mas precisam ganhar capacidade operacional para passageiros:

- capacidade total de passageiros
- tipos de vaga
- configuracao de assentos/redes

### Rotas

Ja existem, e podem virar base de:

- itinerario
- duracao prevista
- tarifa base de passagem

### Caixa

Ja existe e pode receber nova origem de lancamento, por exemplo:

- `origem: Venda de passagem`
- `passagemCodigo`
- `viagemId`

### QR Code

Ja existe e pode ser reutilizado como:

- bilhete digital
- comprovante de check-in
- validacao de embarque

### PDF

Ja existe a infraestrutura mental e tecnica para:

- bilhete de passagem
- comprovante de compra
- mapa de embarque
- manifesto de passageiros

## 11. Riscos de adaptar demais o modelo de encomenda

Evite colocar passagem dentro de `encomendas`, porque:

- a semantica de remetente/destinatario nao casa com passageiro
- o status atual foi desenhado para objeto transportado
- a baixa com assinatura hoje representa retirada/entrega, nao embarque
- caixa e comprovantes ficariam ambíguos
- o codigo e o rastreio perderiam clareza de dominio

## 12. Melhor estrategia de evolucao

### Fase 1

- criar colecoes novas de passagens e viagens
- criar cadastro de passageiro
- reaproveitar terminais, embarcacoes e rotas

### Fase 2

- criar tela de venda de passagem
- gerar codigo e QR do bilhete
- integrar com caixa
- gerar PDF de bilhete

### Fase 3

- criar tela de consulta/listagem de passagens
- criar tela de leitura do QR para embarque
- criar status de check-in e embarque

### Fase 4

- criar relatorios
- criar resumo financeiro separado por frete x passagem
- criar manifesto por viagem
- criar controles de lotacao

## 13. Conclusao curta

Hoje o sistema e um ERP operacional enxuto para fretes hidroviarios. Ele ja possui boa parte da infraestrutura necessaria para vender passagens, mas ainda nao possui o modelo de dominio correto para passageiro, viagem e embarque. A melhor estrategia e manter o frete como modulo atual e criar um modulo novo de passagens sobre a mesma base administrativa.

