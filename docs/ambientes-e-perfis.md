# Ambientes e perfis de acesso

## Enderecos

- `/terminal`: prepara o navegador/PWA para uso operacional na maquineta.
- `/computador`: prepara o navegador para uso administrativo no computador.
- `/login`: preserva o ambiente ja configurado no navegador.

O ambiente escolhido fica salvo apenas no aparelho. Na VT-Q2i, acesse `/terminal` antes de instalar o PWA.

## Operador no terminal

O perfil `operador` pode acessar:

- novo frete;
- scanner e confirmacao de retirada;
- nova passagem;
- consulta e reimpressao de passagens;
- scanner de embarque;
- caixa.

Dashboard, cadastros e administracao ficam bloqueados no menu e nas rotas.

## Gestor no computador

O perfil `gestor` administra apenas a empresa vinculada ao seu usuario e pode acessar:

- dashboard;
- clientes e passageiros;
- linhas e horarios;
- terminais;
- embarcacoes;
- rotas e valores;
- consultas operacionais e caixa.

## Superadmin no computador

O perfil `superadmin` possui acesso central a empresas, usuarios, logs e aos dados operacionais. Gestor e superadmin nao podem entrar pelo ambiente `/terminal`.

## Seguranca

As opcoes sao filtradas no menu, bloqueadas nas rotas React e protegidas nas regras do Firestore. Colecoes de configuracao (`terminais`, `embarcacoes`, `rotasValores` e `programacoesViagem`) somente aceitam gravacao de gestor da mesma empresa ou superadmin.
