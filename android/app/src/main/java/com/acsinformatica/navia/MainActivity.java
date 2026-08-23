package com.acsinformatica.navia;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NaviaPrinterPlugin.class);
        super.onCreate(savedInstanceState);
        // Os assets web sao empacotados no APK com nomes versionados. Limpar
        // somente o cache HTTP impede que o WebView antigo procure chunks que
        // ja foram substituidos, sem apagar login, preferencias ou Firestore.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }
    }
}
