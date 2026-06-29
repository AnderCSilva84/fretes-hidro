# NAVIA - Roteiro Completo Para NotebookLM

Este documento foi preparado para ser usado como base de apresentacao no NotebookLM.
Ele descreve, em linguagem clara, tudo o que o sistema NAVIA tem, faz e resolve hoje.

## 1. Resumo executivo

O NAVIA e um sistema web em formato PWA voltado para operacoes de fretes hidroviarios e venda de passagens.
Ele foi pensado para empresas que precisam controlar atendimento de balcao, postagem de encomendas, venda de bilhetes, embarque de passageiros, caixa operacional e acompanhamento gerencial em desktop, tablet e celular.

Na pratica, o NAVIA centraliza dois mundos que normalmente ficam separados:

1. Operacao de fretes e encomendas.
2. Operacao de passagens e embarque.

O sistema tambem possui recursos de funcionamento offline, fila de sincronizacao, controle por perfis, dashboard operacional, impressao de documentos, rastreio publico e interface responsiva.

## 2. O problema que o NAVIA resolve

Antes do NAVIA, a operacao costuma sofrer com:

1. Controles manuais ou espalhados em papeis, planilhas e aplicativos diferentes.
2. Falta de visao integrada entre fretes, passagens, caixa e embarque.
3. Dificuldade de operar em ambientes com internet instavel.
4. Retrabalho para cadastro de clientes, passageiros, linhas, embarcacoes e terminais.
5. Falta de rastreabilidade de encomendas e vendas.
6. Dificuldade para gerar comprovantes, bilhetes, manifestos e resumos de caixa.
7. Pouca visibilidade gerencial sobre ocupacao, horarios de pico, gratuidades e comportamento da linha.

O NAVIA resolve isso entregando um unico ambiente operacional e gerencial.

## 3. O que e o NAVIA

O NAVIA e um sistema:

1. PWA, instalavel como aplicativo.
2. Responsivo para desktop, tablet e celular.
3. Preparado para operar com Firebase online e com suporte offline/local quando necessario.
4. Organizado por modulos de Fretes e Passagens.
5. Protegido por autenticacao e controle de acesso por perfil e por modulo.

## 4. Principais modulos do sistema

O NAVIA possui os seguintes modulos e areas principais:

1. Dashboard administrativo.
2. Modulo de Fretes.
3. Modulo de Passagens.
4. Caixa.
5. Estrutura compartilhada.
6. Administracao.
7. Rastreio publico.

## 5. Dashboard administrativo

O dashboard funciona como painel operacional e gerencial.
Ele foi separado em duas leituras principais: Fretes e Passagens.

### 5.1. Indicadores de Fretes

O painel de fretes mostra:

1. Total de encomendas.
2. Total de clientes.
3. Total de terminais.
4. Caixa do periodo.
5. Encomendas em fluxo.
6. Encomendas em espera de retirada.
7. Encomendas entregues ao cliente.

### 5.2. Indicadores de Passagens

O painel de passagens mostra:

1. Passagens vendidas.
2. Viagens ativas.
3. Passagens embarcadas.
4. Caixa de passagens.
5. Embarcacao destaque.
6. Taxa de ocupacao.
7. Horario de pico.
8. Percentual de gratuidades.
9. Dia mais movimentado.

### 5.3. Graficos do dashboard

O dashboard tambem mostra visualmente:

1. Grafico de barras com os dias da semana e a quantidade de passageiros transportados.
2. Grafico por faixa horaria de 5h as 19h para identificar horarios de pico.

### 5.4. Filtro por periodo

O dashboard possui filtro por data inicial e data final.
Quando nao ha filtro manual, o sistema assume automaticamente o dia atual.
Ao mudar o dia, o painel se renova para o novo periodo do dia.

### 5.5. Atalhos rapidos

O dashboard oferece atalhos para:

1. Novo frete.
2. Nova passagem.
3. Cadastro de cliente.
4. Consulta de encomendas.
5. Rastreio publico.
6. Cadastro de passageiro.
7. Consulta de passagens.
8. Gestao de terminais.

## 6. Modulo de Fretes

O modulo de fretes organiza toda a jornada da encomenda, do balcão ao rastreio.

### 6.1. Nova Comanda / Novo Frete

Nesta tela o operador pode:

1. Registrar data da comanda.
2. Registrar horario de postagem.
3. Definir horario de saida da embarcacao.
4. Selecionar rota.
5. Selecionar embarcacao.
6. Escolher ou cadastrar remetente.
7. Escolher ou cadastrar destinatario.
8. Definir terminal de origem e destino.
9. Informar nota fiscal e valor declarado.
10. Definir forma de cobranca do frete.
11. Informar itens do frete.
12. Informar valor total.
13. Gerar QR Code.
14. Gerar URL de rastreio.
15. Salvar o frete.
16. Imprimir comprovante.

### 6.2. Cadastro de Clientes

O modulo possui cadastro de clientes para:

1. Remetentes.
2. Destinatarios.
3. Busca leve e paginada.
4. Reaproveitamento de cadastro nas proximas comandas.

### 6.3. Lista de Encomendas

O sistema permite consultar encomendas com:

1. Busca por codigo.
2. Busca por remetente.
3. Busca por destinatario.
4. Consulta operacional com carga reduzida.
5. Abertura do rastreio publico.

### 6.4. Scanner de Retirada

Ha uma tela de leitura operacional para retirada, pensada para localizar e processar a encomenda com mais agilidade.

### 6.5. Retirada e Entrega

O sistema permite:

1. Fazer baixa de retirada.
2. Registrar quem recebeu.
3. Registrar documento do recebedor.
4. Gravar observacoes.
5. Registrar assinatura do cliente.
6. Gerar recibo de retirada ou entrega.

### 6.6. Rastreio publico

O NAVIA oferece rastreio publico por codigo da encomenda.
Nele e possivel:

1. Consultar dados principais da postagem.
2. Ver status atual.
3. Ver origem e destino.
4. Ver o historico de movimentacoes sob demanda.
5. Abrir comprovante em PDF.
6. Reabrir recibo assinado quando houver assinatura registrada.

## 7. Modulo de Passagens

O modulo de passagens foi desenvolvido para operacao de balcão com foco em rapidez, clareza e controle da viagem.

### 7.1. Nova Passagem

Esta e a tela principal de venda de bilhetes.
Ela permite:

1. Selecionar data da viagem.
2. Selecionar linha.
3. Selecionar embarcacao.
4. Selecionar horario de saida.
5. Localizar passageiro por nome.
6. Aproveitar cadastro existente de passageiro.
7. Informar documento e telefone.
8. Montar uma venda com multiplas tarifas na mesma compra.
9. Trabalhar com tarifas como inteira, meia, gratuidade, estudante, idoso, crianca de colo e passagem antecipada.
10. Definir forma de pagamento.
11. Abrir caixa do horario.
12. Encerrar caixa do horario.
13. Vender e imprimir automaticamente.
14. Registrar sem imprimir.
15. Gerar PDF do bilhete.
16. Reimprimir termico.
17. Estornar venda.

### 7.2. Regras operacionais da venda

O modulo tambem controla regras de negocio importantes:

1. Janela de venda por horario.
2. Status do caixa por viagem.
3. Capacidade da embarcacao.
4. Vagas vendidas e vagas disponiveis.
5. Percentual de gratuidade configurado por linha.
6. Saldo da referencia de gratuidades.
7. Diferenca entre passagens que impactam capacidade e passagens antecipadas.

### 7.3. Resumo da saida

Ao lado da venda, o sistema exibe resumo operacional da viagem com:

1. Origem.
2. Destino.
3. Data.
4. Horario.
5. Status do caixa.
6. Momento de abertura do caixa.
7. Janela de venda.
8. Embarcacao.
9. Vagas disponiveis.
10. Passagens vendidas.
11. Gratuidade da linha.
12. Saldo de referencia.
13. Tarifa base.
14. Total da venda atual.

### 7.4. Historico do embarque

Na mesma tela o sistema mostra:

1. Historico das passagens vendidas para aquela saida.
2. Tarifa aplicada.
3. Codigo da passagem.
4. Nome do passageiro.
5. Forma de pagamento.
6. Valor.
7. Botao de impressao termica.
8. Botao de estorno.

## 8. Cadastro de Passageiros

Existe um cadastro dedicado de passageiros, separado dos clientes de frete.
Isso ajuda a manter os dominios limpos e melhora a busca para venda de passagens.

## 9. Consulta de Passagens

O sistema possui tela especifica para:

1. Buscar passagens.
2. Reimprimir bilhetes.
3. Abrir impressao termica.
4. Cancelar passagens.
5. Consultar historicos de caixas de venda fechados.
6. Reexportar resumos em PDF.
7. Abrir manifesto da viagem.

## 10. Embarque de passageiros

O NAVIA possui um fluxo de embarque com scanner dedicado.

### 10.1. Scanner de embarque

Permite:

1. Ler QR Code do bilhete pela camera.
2. Ler QR Code por foto.
3. Digitar codigo manualmente.
4. Consultar o bilhete.
5. Confirmar o embarque.

### 10.2. Manifesto da viagem

Para cada viagem, o sistema gera um manifesto operacional com:

1. Lista de passageiros.
2. Situacao de cada bilhete.
3. Total vendido.
4. Total embarcado.
5. Total pendente.
6. Total cancelado.
7. Exportacao em PDF.

## 11. Caixa

O modulo de caixa acompanha entradas operacionais e historicos financeiros.

### 11.1. Resumo financeiro

O sistema mostra:

1. Total de entradas.
2. Total de registros.
3. Movimentacoes de frete.
4. Movimentacoes de passagens.
5. Outros lancamentos.

### 11.2. Filtro por periodo

O caixa possui filtro por periodo com data inicial e data final em formato brasileiro.

### 11.3. Historico de viagens

No contexto de passagens, o caixa mostra:

1. Caixas de viagens ja fechados.
2. Horario de abertura e fechamento.
3. Lista de passageiros por viagem.
4. Exportacao do resumo em PDF.
5. Exclusao de historico por superadmin principal.

### 11.4. Movimentacoes do caixa

O usuario tambem pode:

1. Consultar lancamentos individuais.
2. Filtrar por origem financeira.
3. Exportar PDF.
4. Excluir lancamentos.

## 12. Estrutura compartilhada

O sistema possui cadastros estruturais que servem aos dois modulos.

### 12.1. Terminais

Cadastro e manutencao de bases de embarque e desembarque.

### 12.2. Embarcacoes

Cadastro de embarcacoes com dados operacionais e capacidade.

### 12.3. Rotas e Valores

Cadastro de linhas com:

1. Origem e destino.
2. Terminal de origem.
3. Terminal de destino.
4. Terminais alternativos de destino.
5. Valor padrao.
6. Duracao prevista.
7. Percentual de gratuidade.
8. Definicao de exibicao por modulo, como fretes, passagens ou ambos.

## 13. Administracao

O NAVIA possui uma camada administrativa para governanca do sistema.

### 13.1. Usuarios

Permite:

1. Cadastro de usuarios.
2. Definicao de perfil.
3. Controle de ativacao.
4. Vinculo com empresa.
5. Controle de acesso por modulo.
6. Simulacao de acesso por superadmin principal.

### 13.2. Empresas

Permite:

1. Cadastro de empresas.
2. Separacao de operacao por empresa.
3. Estrutura para uso multiempresa.

### 13.3. Logs de uso

O sistema registra eventos administrativos e operacionais relevantes para auditoria e acompanhamento.

## 14. Controle de acesso

O NAVIA trabalha com:

1. Login autenticado.
2. Perfis de acesso.
3. Restricao por modulo.
4. Restricao por empresa.
5. Superadmin principal com capacidades ampliadas.
6. Protecao de rotas.

## 15. Funcionamento offline e PWA

Um dos grandes diferenciais do NAVIA e a preparacao para cenarios com internet instavel.

### 15.1. PWA

O sistema:

1. Pode ser instalado como aplicativo.
2. Tem manifest.
3. Tem splash de abertura.
4. Usa service worker.
5. Tem identidade visual propria com nome NAVIA.

### 15.2. Cache local

Quando o navegador e o ambiente permitem, o sistema usa cache local persistente para continuar acessando dados.

### 15.3. Fila offline

O sistema possui fila offline e sincronizacao para acoes operacionais.
Hoje essa fila cobre especialmente:

1. Venda de passagem offline.
2. Cancelamento de passagem offline.
3. Abertura de caixa de passagens offline.
4. Fechamento de caixa de passagens offline.
5. Confirmacao de embarque offline.

### 15.4. Sincronizacao e conflito

Quando a conexao volta, o sistema:

1. Sincroniza as acoes pendentes.
2. Confere se a operacao apareceu na base principal.
3. Marca conflitos quando ha divergencia, por exemplo em capacidade ou confirmacao.
4. Exibe resumo da fila offline.

### 15.5. Banner de conectividade

O usuario recebe comunicacao visual de:

1. Falta de internet.
2. Retorno da conexao.
3. Fila pendente.
4. Fila sincronizando.
5. Conflitos e erros de sincronizacao.

## 16. Documentos e impressoes

O sistema gera documentos operacionais importantes:

1. Comprovante de frete.
2. Etiqueta com QR Code.
3. Bilhete de passagem em PDF.
4. Bilhete termico.
5. Recibo de retirada ou entrega.
6. Manifesto de viagem em PDF.
7. Resumo de vendas do caixa por horario em PDF.
8. Relatorio de caixa em PDF.
9. Relatorio de clientes em PDF.

## 17. Identidade visual e experiencia de uso

O NAVIA foi ajustado para:

1. Funcionar bem em desktop, tablet e celular.
2. Ter leitura limpa nas telas operacionais.
3. Separar claramente Fretes e Passagens.
4. Entregar navegacao rapida com menu lateral e menu inferior.
5. Exibir a marca NAVIA de forma consistente em telas e documentos.

## 18. Tecnologias utilizadas

O sistema foi construido com:

1. React.
2. React Router.
3. Vite.
4. Tailwind CSS.
5. Firebase Authentication.
6. Firestore.
7. jsPDF.
8. QRCode.
9. jsQR.
10. vite-plugin-pwa.

## 19. Diferenciais do NAVIA

Os principais diferenciais do sistema sao:

1. Integracao real entre fretes, passagens, caixa e embarque.
2. Operacao preparada para internet instavel.
3. PWA instalavel.
4. Separacao por modulos e empresas.
5. Dashboard operacional e gerencial.
6. Impressao de documentos e bilhetes.
7. Rastreio publico.
8. Scanner de embarque.
9. Controle de caixa por viagem.
10. Indicadores de ocupacao, pico e gratuidades.

## 20. Pontos de valor para apresentar

Em uma apresentacao, vale reforcar que o NAVIA:

1. Organiza a operacao do balcao.
2. Reduz retrabalho.
3. Melhora a rastreabilidade.
4. Da visibilidade gerencial.
5. Continua util mesmo com internet ruim.
6. Centraliza fretes e passagens em um so ambiente.
7. Ajuda a profissionalizar a operacao hidroviaria.

## 21. Texto pronto para colar no NotebookLM

Use o texto abaixo como prompt base:

"Quero uma apresentacao profissional sobre o sistema NAVIA. O NAVIA e um sistema PWA para operacao de fretes hidroviarios e venda de passagens, com foco em desktop, tablet e celular. Ele possui dashboard administrativo, modulo de fretes, modulo de passagens, caixa, rastreio publico, scanner de embarque, manifesto de viagem, impressao de comprovantes e funcionamento offline com fila de sincronizacao. Monte uma apresentacao clara, comercial e institucional, destacando o problema que o sistema resolve, os modulos, os fluxos operacionais, os diferenciais, os beneficios para a empresa e os ganhos de controle, produtividade e rastreabilidade. Estruture a apresentacao em slides com titulos fortes, linguagem executiva e foco em valor."

## 22. Estrutura sugerida de apresentacao

Se quiser, a apresentacao pode seguir esta ordem:

1. O que e o NAVIA.
2. Problemas operacionais que ele resolve.
3. Visao geral dos modulos.
4. Dashboard e inteligencia operacional.
5. Fluxo de fretes.
6. Fluxo de passagens.
7. Caixa e fechamento operacional.
8. Embarque e manifesto.
9. Offline e PWA.
10. Diferenciais competitivos.
11. Beneficios para a empresa.
12. Encerramento com proposta de valor.

## 23. Fechamento institucional

O NAVIA nao e apenas um sistema de cadastro.
Ele e uma plataforma operacional para empresas de transporte hidroviario que precisam vender, embarcar, rastrear, registrar, imprimir, conciliar e acompanhar sua operacao com mais controle, menos improviso e mais inteligencia.

