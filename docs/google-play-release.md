# Publicação do NAVIA Terminal no Google Play

## Estado encontrado em 27/09/2026

- Projeto Android Capacitor 7 já existe em `android/`.
- Identificador: `com.acsinformatica.navia`. Antes do primeiro envio, confirme se será o identificador definitivo: após publicar, não pode ser trocado para o mesmo app.
- Nome instalado: `NAVIA Terminal`.
- `android/variables.gradle` usa compileSdk/targetSdk 35; novos envios exigem targetSdk 36. Atualize Android Gradle Plugin/Gradle se necessário e valide o build e o comportamento em Android 16 antes de mudar os números.
- `android/app/build.gradle` está em versionCode 4 / versionName 1.3; confirme se houve uploads anteriores antes de alterar versionCode.

## Preparação técnica

1. Instale Android SDK 36, JDK e Android Studio compatíveis. Atualize compileSdk/targetSdk para 36 e as ferramentas Gradle necessárias; rode `./gradlew :app:bundleRelease` para validar.
2. Rode `npm ci && npm run build && npx cap sync android`. Confira plugins nativos, câmera/leitura QR e impressão térmica na VT-Q2i. Faça teste no Android 16, sobretudo barras do sistema e layout em tela cheia.
3. Configure a chave de upload localmente, assine o Android App Bundle (.aab) e guarde a chave e senhas fora do repositório. Não envie arquivos keystore nem senhas ao GitHub.
4. Suba o AAB em teste interno no Play Console. Teste instalação, login, perfis, QR, impressão, operação sem rede e retorno da conexão em dispositivos reais.
5. Prepare ícone 512x512, imagem de destaque 1024x500, capturas reais, descrições, e-mail de suporte, URL pública da política de privacidade e credenciais de demonstração para a análise, se o login bloquear o acesso.
6. Declare os dados coletados e compartilhados na seção Segurança dos dados com base no Firebase e nos recursos efetivos. Verifique a exigência de exclusão de conta no app e por URL pública se o próprio usuário puder criar uma conta.
7. Escolha distribuição pública ou privada para empresas clientes conforme o uso do NAVIA. Revise permissões, acesso e cobrança antes do lançamento.

Não gerar pacote de produção nem publicar enquanto a conta Play Console, a chave de upload, as URLs legais e o teste em aparelhos reais não estiverem disponíveis.
