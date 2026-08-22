# Fretes Hidroviários

PWA em React + Vite para controle de fretes e encomendas em terminais hidroviários do Pará.

## Stack

- React + Vite
- Firebase Auth
- Firestore
- React Router DOM
- Tailwind CSS
- qrcode
- jsPDF
- vite-plugin-pwa

## Instalação

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Preencha as variáveis do Firebase no `.env`.

4. Inicie o projeto:

```bash
npm run dev
```

5. Gere o build de produção:

```bash
npm run build
```

## Impressao termica silenciosa no Windows

Para operar com impressao termica direta na impressora padrao do Windows:

```bash
npm run thermal-agent
```

O PWA tenta primeiro o helper local em `http://127.0.0.1:18181` e, se ele nao estiver disponivel, volta para `window.print()`.

Detalhes de configuracao e contrato do helper:

- [docs/impressao-termica-windows.md](./docs/impressao-termica-windows.md)

## Impressao termica na VT-Q2i (Android)

O PWA reconhece Android e envia os bilhetes de 58 mm em ESC/POS para o RawBT. A configuracao da maquineta esta em:

- [docs/impressao-termica-vt-q2i.md](./docs/impressao-termica-vt-q2i.md)

## Ambientes e perfis

O sistema separa o ambiente operacional da maquineta (`/terminal`) do ambiente de gestao no computador (`/computador`).

- [docs/ambientes-e-perfis.md](./docs/ambientes-e-perfis.md)

## Firebase

O projeto já vem preparado para Firebase Hosting com `firebase.json` e `.firebaserc`.

Configure um projeto no Firebase e substitua o alias em `.firebaserc` se necessário.

Também estão incluídos `firestore.rules` e `firestore.indexes.json` com a configuração inicial para leitura pública do rastreio e gravação autenticada.

## Deploy Firebase

Depois de preencher o `.env` e configurar o projeto do Firebase, rode:

```bash
firebase login
firebase use --add
firebase deploy
```

## Rotas principais

- `/login`
- `/dashboard`
- `/nova-comanda`
- `/clientes`
- `/terminais`
- `/embarcacoes`
- `/rotas-valores`
- `/encomendas`
- `/caixa`
- `/rastreio/:codigo`

## Observações

Se as variáveis do Firebase não estiverem preenchidas, o app entra em modo demo usando armazenamento local para permitir navegação e testes da interface.
