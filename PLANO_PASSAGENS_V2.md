# Plano Executivo V2: Implementacao de Venda de Passagens

Este documento e uma proposta objetiva de como evoluir o sistema atual de fretes para incluir um modulo de venda de passagens sem quebrar a operacao existente.

## 1. Diretriz principal

A recomendacao e:

- manter `fretes/encomendas` como modulo independente
- criar `passagens` como novo modulo de negocio
- compartilhar a base administrativa existente

O sistema passaria a ter dois produtos operacionais dentro da mesma plataforma:

- Fretes
- Passagens

O que continua compartilhado:

- login e perfis
- empresas
- usuarios
- terminais
- embarcacoes
- rotas
- caixa
- QR Code
- PDFs
- logs

## 2. Decisao arquitetural recomendada

Nao recomendo adaptar `encomendas` para guardar passagens.

Recomendo criar um novo conjunto de entidades:

- `passageiros`
- `viagens`
- `passagens`
- `embarquesPassagens`
- `tarifasPassagens`

Opcional, dependendo da operacao:

- `mapasAssentos`
- `bloqueiosPoltronas`
- `cuponsDesconto`

## 3. Modelo de dominio proposto

## 3.1. `passageiros`

Finalidade:

- cadastro da pessoa que vai viajar
- reaproveitavel em compras futuras

Campos sugeridos:

```text
id
nome
documento
dataNascimento
telefone
email
sexo
responsavelNome
responsavelDocumento
observacoes
empresaId
empresaNome
criadoEm
atualizadoEm
```

Observacao:

- nao reaproveitar `clientes` diretamente como fonte oficial de passageiro
- no maximo, criar importacao futura

## 3.2. `tarifasPassagens`

Finalidade:

- tabela tarifaria por rota
- separacao entre valor de frete e valor de passagem

Campos sugeridos:

```text
id
rotaId
origem
destino
terminalOrigem
terminalDestino
tipoTarifa
valor
categoriaPassageiro
bagagemIncluidaKg
remarcacaoPermitida
cancelamentoPermitido
ativo
empresaId
empresaNome
criadoEm
atualizadoEm
```

Exemplos de `categoriaPassageiro`:

- adulto
- crianca
- idoso
- estudante
- promocional

## 3.3. `viagens`

Finalidade:

- representar uma partida real em determinada data e hora
- controlar lotacao e embarque

Campos sugeridos:

```text
id
codigoViagem
rotaId
origem
destino
terminalOrigem
terminalDestino
embarcacaoId
embarcacaoNome
dataViagem
horaSaida
horaPrevistaChegada
duracaoMinutos
status
capacidadePassageiros
capacidadeDisponivel
capacidadeReservada
capacidadeEmbarcada
permiteVenda
permiteCheckin
observacoes
empresaId
empresaNome
criadoEm
atualizadoEm
```

Status sugeridos:

- agendada
- embarque_aberto
- encerrada
- cancelada

## 3.4. `passagens`

Finalidade:

- entidade principal da venda

Campos sugeridos:

```text
id
codigoPassagem
codigoBilhete
viagemId
codigoViagem
rotaId
embarcacaoId
embarcacaoNome
passageiroId
passageiroNome
passageiroDocumento
compradorNome
compradorDocumento
compradorTelefone
compradorEmail
categoriaPassageiro
tipoTarifa
valorTarifa
taxaServico
desconto
valorTotal
formaPagamento
status
qrCodeDataUrl
bilheteUrl
assentoCodigo
bagagemDespachada
pesoBagagem
checkinRealizadoEm
embarcadoEm
canceladoEm
motivoCancelamento
empresaId
empresaNome
operadorNome
operadorEmail
criadoEm
atualizadoEm
```

Status sugeridos:

- reservada
- paga
- checkin_realizado
- embarcada
- utilizada
- cancelada
- remarcada

## 3.5. `embarquesPassagens`

Finalidade:

- trilha de operacao no embarque
- historico separado da passagem

Campos sugeridos:

```text
id
passagemId
codigoPassagem
viagemId
acao
descricao
operadorNome
operadorEmail
criadoEm
empresaId
empresaNome
```

Acoes sugeridas:

- venda_realizada
- pagamento_confirmado
- checkin_realizado
- embarque_liberado
- embarque_concluido
- cancelamento
- remarcacao

## 4. Regras de negocio recomendadas

## 4.1. Venda

- nao vender passagem para viagem cancelada
- nao vender acima da capacidade
- toda passagem paga deve gerar lancamento no caixa
- toda passagem deve gerar QR Code unico
- toda passagem deve poder gerar PDF do bilhete

## 4.2. Capacidade

- `capacidadeDisponivel` da viagem deve diminuir a cada venda confirmada
- reservas temporarias podem expirar se nao forem pagas
- cancelamentos podem devolver vaga para a viagem

## 4.3. Check-in e embarque

- check-in so pode acontecer em passagem paga
- embarque so pode acontecer em passagem com check-in liberado, se essa regra existir
- o QR deve validar a passagem e a viagem
- uma passagem nao pode embarcar duas vezes

## 4.4. Cancelamento e remarcacao

- definir janela minima para cancelamento
- definir se ha multa
- definir se remarcacao gera diferenca tarifaria

## 4.5. Financeiro

- diferenciar caixa de frete e caixa de passagem por `origem`
- permitir relatorio consolidado e separado

## 5. Telas novas recomendadas

## 5.1. `NovaPassagem`

Funcao:

- vender nova passagem

Campos principais:

- data da viagem
- rota
- embarcacao/viagem
- passageiro
- categoria tarifaria
- valor
- forma de pagamento
- observacoes

Acoes:

- salvar venda
- gerar QR
- gerar PDF
- compartilhar bilhete

## 5.2. `Passagens`

Funcao:

- listar e consultar passagens vendidas

Recursos:

- busca por codigo da passagem
- busca por nome/documento do passageiro
- filtro por viagem
- filtro por status
- abrir bilhete PDF
- reenviar comprovante
- cancelar
- remarcar

## 5.3. `Viagens`

Funcao:

- criar e administrar partidas do dia

Recursos:

- selecionar rota
- selecionar embarcacao
- definir data/hora
- visualizar capacidade
- abrir/fechar embarque

## 5.4. `CheckInEmbarque`

Funcao:

- validar passageiro no embarque

Recursos:

- leitura de QR
- busca manual por codigo/documento
- marcar check-in
- marcar embarque
- impedir duplicidade

## 5.5. `Passageiros`

Funcao:

- cadastro e consulta de passageiros

## 5.6. `TarifasPassagens`

Funcao:

- manter precos e categorias por rota

## 5.7. `RelatoriosPassagens`

Funcao:

- consolidado comercial e operacional

Relatorios sugeridos:

- vendas por periodo
- vendas por rota
- vendas por embarcacao
- ocupacao por viagem
- cancelamentos
- embarques realizados

## 6. Reaproveitamento das telas e recursos atuais

## 6.1. Pode reaproveitar quase direto

- login
- perfis
- empresas
- usuarios
- terminais
- embarcacoes
- caixa base
- logs
- geracao de QR
- geracao de PDF
- compartilhamento de PDF
- scanner de QR como base tecnica

## 6.2. Reaproveita com adaptacao

- rotas: manter para frete, mas criar tarifa separada para passagem
- clientes: nao usar como passageiro oficial
- rastreio: criar versao de consulta de bilhete, nao misturar com rastreio de encomenda

## 6.3. Nao recomendo reaproveitar como esta

- `encomendas`
- `movimentacoes` de encomendas
- fluxo de retirada/entrega com assinatura

## 7. Impacto no caixa

Sugestao de padrao para colecao `caixa`:

Adicionar campos complementares quando a origem for passagem:

```text
origem: "Venda de passagem"
tipo: "entrada"
passagemId
codigoPassagem
viagemId
passageiroNome
formaPagamento
valor
```

Beneficios:

- relatorio unico do financeiro continua funcionando
- fica facil separar frete e passagem por filtro

## 8. Impacto nas embarcacoes

A entidade `embarcacoes` precisa evoluir para suportar passageiros.

Novos campos sugeridos:

```text
capacidadePassageiros
possuiAssentosMarcados
quantidadeAssentos
layoutAssentos
tiposAcomodacao
```

Se a operacao nao tiver assento marcado:

- controlar apenas quantidade total de vagas

Se a operacao tiver assento marcado:

- criar mapa de assentos por embarcacao ou por tipo de embarcacao

## 9. Impacto nas rotas

Manter `rotasValores` como base operacional de rota pode continuar funcionando, mas eu recomendo separar tarifa de passagem em outra colecao para evitar mistura conceitual.

Melhor desenho:

- `rotasValores`: estrutura logistica
- `tarifasPassagens`: estrutura comercial de passagens

## 10. Impacto no QR Code

Hoje o QR leva ao rastreio da encomenda.

Para passagens, o QR pode levar a:

- tela publica do bilhete
- tela interna de check-in/embarque

Sugestao:

- rota publica: `/bilhete/:codigo`
- rota interna de operacao: `/embarque/:codigo`

## 11. Impacto em PDFs

Novos PDFs recomendados:

- bilhete de passagem
- comprovante de pagamento
- manifesto de embarque
- relatorio de ocupacao da viagem

O padrao atual de `jsPDF` ja serve bem para isso.

## 12. Estrategia de implementacao por fases

## Fase 1: Fundacao

Objetivo:

- preparar estrutura sem alterar o frete

Entregas:

- colecoes novas
- cadastro de passageiros
- cadastro de tarifas de passagens
- cadastro de viagens

## Fase 2: Venda

Objetivo:

- vender passagem ponta a ponta

Entregas:

- tela NovaPassagem
- geracao de codigo
- QR Code
- bilhete PDF
- integracao com caixa
- listagem inicial de passagens

## Fase 3: Check-in e embarque

Objetivo:

- operacionalizar o embarque

Entregas:

- scanner para bilhete
- tela de check-in
- tela de embarque
- controle de status da passagem
- bloqueio de uso duplicado

## Fase 4: Pos-venda e relatorios

Objetivo:

- amadurecer governanca e operacao

Entregas:

- cancelamento
- remarcacao
- relatorios
- dashboard de ocupacao
- indicadores financeiros de passagens

## 13. Sugestao de menu futuro

Estrutura recomendada:

- Operacao
- Novo Frete
- Nova Passagem
- Encomendas
- Passagens
- Scanner Embarque
- Caixa

- Cadastros
- Clientes
- Passageiros
- Terminais
- Embarcacoes
- Rotas
- Tarifas de Passagens
- Viagens

- Administracao
- Usuarios
- Empresas
- Logs

## 14. MVP recomendado

Se a meta for entrar rapido em operacao, o MVP de passagens pode ser:

- sem assento marcado
- sem remarcacao automatizada
- sem cancelamento complexo
- sem compra online
- venda interna por operador
- QR para validacao no embarque
- bilhete PDF
- baixa no caixa

Esse MVP ja entrega muito valor com risco moderado.

## 15. Minha recomendacao final

O melhor caminho e criar um segundo produto dentro da mesma plataforma:

- modulo Fretes
- modulo Passagens

Sem misturar as entidades principais.

Se voce fizer isso, ganha:

- menos risco de quebrar o que ja funciona
- modelo de dados mais limpo
- evolucao mais facil
- relatorios mais claros
- operacao mais intuitiva para a equipe

## 16. Proximo passo tecnico recomendado

Se quiser seguir para implementacao, a proxima etapa ideal e desenhar:

1. schema inicial das colecoes novas
2. rotas React novas
3. servicos Firebase para passagens
4. tela `NovaPassagem`
5. integracao com `caixa`

