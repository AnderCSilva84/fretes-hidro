# Impressao termica na VT-Q2i (Android)

A VT-Q2i possui uma impressora termica interna de 58 mm que, nas variantes Q2i/JP-Q2, e disponibilizada ao Android como impressora Bluetooth ESC/POS.

## Preparacao da maquineta

1. Conecte a VT-Q2i ao Wi-Fi e abra o NAVIA no Chrome.
2. Instale o aplicativo **RawBT Print Service** pela Play Store.
3. Abra o RawBT e conceda as permissoes solicitadas (Bluetooth/dispositivos proximos).
4. Em `Connection`, selecione `Bluetooth` e escolha a impressora interna da Q2i. O nome pode variar entre `Printer`, `InnerPrinter`, `Q2`, `JP-Q2` ou um endereco Bluetooth.
5. Defina papel de `58 mm` / `32 caracteres` e perfil `ESC/POS general`.
6. Use o teste do RawBT. Somente avance quando o teste sair corretamente.
7. No Chrome, instale o NAVIA como aplicativo pela opcao **Adicionar a tela inicial**.

## Uso no NAVIA

Ao tocar em **Vender e imprimir** ou **Imprimir bilhete**, o Android abre o RawBT, envia o bilhete e retorna ao NAVIA. O bilhete inclui texto e QR Code quando a passagem possui URL de validacao.

O papel avanca ao final para permitir o rasgo manual. A Q2i nao deve receber comando de guilhotina.

## Modos de impressao

O modo padrao `agent-first` escolhe automaticamente:

- Android: RawBT e impressora Bluetooth interna;
- Windows: helper local em `127.0.0.1:18181`;
- outros dispositivos ou falha do helper: dialogo de impressao do navegador.

Para desativar a integracao no navegador da maquineta:

```js
localStorage.setItem('navia-thermal-print-mode', 'browser-only')
```

Para reativar:

```js
localStorage.setItem('navia-thermal-print-mode', 'agent-first')
```

## Diagnostico

- RawBT nao abre: confirme se ele esta instalado e se o Chrome permite abrir links externos.
- Nao encontra a impressora: ative o Bluetooth, conceda a permissao de dispositivos proximos e procure novamente no RawBT.
- Sai papel em branco ou caracteres ilegíveis: use `ESC/POS general`, 58 mm e 32 caracteres no RawBT.
- QR Code nao sai: teste outro perfil ESC/POS no RawBT; o texto do bilhete continua valido mesmo sem o QR.
- Impressao muito clara: carregue a bateria e aumente a densidade nas configuracoes do RawBT.
