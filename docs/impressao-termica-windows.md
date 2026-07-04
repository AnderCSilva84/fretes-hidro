# Impressao termica silenciosa no Windows

O NAVIA agora tenta imprimir em modo `agent-first`.

Para subir o helper local no Windows:

```bash
npm run thermal-agent
```

Fluxo:

1. O app envia os comprovantes para `http://127.0.0.1:18181/print/thermal`.
2. Se o helper local responder com sucesso, a impressao sai sem abrir o dialogo do navegador.
3. Se o helper nao estiver disponivel, o sistema faz fallback para `window.print()`.

Payload esperado pelo helper:

```json
{
  "source": "navia-pwa",
  "requestedAt": "2026-06-30T12:00:00.000Z",
  "documents": [
    {
      "jobId": "thermal-print-...",
      "title": "Bilhete PAS-...",
      "widthMm": 80,
      "copies": 1,
      "cut": true,
      "html": "<!DOCTYPE html>...",
      "text": "BILHETE DE PASSAGEM\n...",
      "payload": {
        "codigo": "PAS-...",
        "viagemId": "viagem-...",
        "passageiroNome": "Nome"
      }
    }
  ]
}
```

Configuracao opcional no navegador:

- `localStorage["navia-thermal-print-agent-url"] = "http://127.0.0.1:18181"`
- `localStorage["navia-thermal-print-mode"] = "agent-first"`

Valores aceitos para `navia-thermal-print-mode`:

- `agent-first`: tenta helper local e cai para navegador se necessario.
- `browser-only`: usa apenas `window.print()`.

Configuracao opcional por ambiente:

- `VITE_THERMAL_PRINT_AGENT_URL`
- `VITE_THERMAL_PRINT_MODE`

Configuracao opcional do helper local:

- `NAVIA_THERMAL_AGENT_HOST`
- `NAVIA_THERMAL_AGENT_PORT`
- `NAVIA_THERMAL_PRINTER_NAME`

Rota de diagnostico do helper:

- `GET /health`

Observacao:

Sem um helper nativo no Windows, nenhum navegador comum garante impressao totalmente silenciosa. O helper local e o caminho seguro para sair direto na impressora termica sem abrir o dialogo.

Observacao tecnica:

O helper atual imprime a versao em texto do comprovante, otimizada para bobina termica de `80 mm`, diretamente na impressora padrao do Windows ou na impressora definida em `NAVIA_THERMAL_PRINTER_NAME`. Ele nao consulta Firebase nem faz leituras adicionais de banco.
