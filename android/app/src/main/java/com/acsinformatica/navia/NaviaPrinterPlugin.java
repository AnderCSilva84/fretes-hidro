package com.acsinformatica.navia;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.iposprinter.iposprinterservice.IPosPrinterCallback;
import com.iposprinter.iposprinterservice.IPosPrinterService;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NaviaPrinter")
public class NaviaPrinterPlugin extends Plugin {
    private IPosPrinterService printer;
    private boolean bound;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printer = IPosPrinterService.Stub.asInterface(service);
            bound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printer = null;
            bound = false;
        }
    };

    @Override
    public void load() {
        Intent intent = new Intent("com.iposprinter.iposprinterservice.IPosPrintService");
        intent.setPackage("com.iposprinter.iposprinterservice");
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    @PluginMethod
    public void status(PluginCall call) {
        if (!bound || printer == null) {
            call.reject("Servico nativo da impressora indisponivel.");
            return;
        }
        try {
            JSObject result = new JSObject();
            result.put("status", printer.getPrinterStatus());
            call.resolve(result);
        } catch (RemoteException error) {
            call.reject("Falha ao consultar a impressora.", error);
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (!bound || printer == null) {
            call.reject("Servico nativo da impressora indisponivel.");
            return;
        }

        String text = call.getString("text", "");
        String qrCode = call.getString("qrCode", "");
        int feedLines = call.getInt("feedLines", 120);

        new Thread(() -> {
            try {
                int status = printer.getPrinterStatus();
                if (status != 0) {
                    call.reject(printerStatusMessage(status));
                    return;
                }

                IPosPrinterCallback noOp = new IPosPrinterCallback.Stub() {
                    @Override public void onRunResult(boolean success) {}
                    @Override public void onReturnString(String result) {}
                };

                AtomicBoolean completed = new AtomicBoolean(false);
                IPosPrinterCallback completedCallback = new IPosPrinterCallback.Stub() {
                    @Override
                    public void onRunResult(boolean success) {
                        if (!completed.compareAndSet(false, true)) return;
                        if (success) {
                            JSObject result = new JSObject();
                            result.put("printed", true);
                            call.resolve(result);
                        } else {
                            call.reject("A impressora recusou o comprovante.");
                        }
                    }

                    @Override public void onReturnString(String result) {}
                };

                printer.printerInit(noOp);
                printer.setPrinterPrintDepth(6, noOp);
                printer.setPrinterPrintAlignment(0, noOp);
                printer.printSpecifiedTypeText(text + "\n", "ST", 24, noOp);
                if (qrCode != null && !qrCode.trim().isEmpty()) {
                    printer.setPrinterPrintAlignment(1, noOp);
                    printer.printQRCode(qrCode, 6, 1, noOp);
                }
                printer.printerPerformPrint(feedLines, completedCallback);
                // Alguns firmwares do VT-Q2i imprimem normalmente, mas nao
                // devolvem o callback final. A chamada Binder ter retornado
                // significa que o trabalho foi aceito pela fila da impressora.
                if (completed.compareAndSet(false, true)) {
                    JSObject result = new JSObject();
                    result.put("printed", true);
                    result.put("queued", true);
                    call.resolve(result);
                }
            } catch (Exception error) {
                call.reject("Falha ao imprimir no VT-Q2i.", error);
            }
        }, "navia-printer").start();
    }

    private String printerStatusMessage(int status) {
        switch (status) {
            case 1: return "Impressora sem papel.";
            case 2: return "Cabeca termica superaquecida.";
            case 3: return "Motor da impressora superaquecido.";
            case 4: return "Impressora ocupada.";
            default: return "Impressora indisponivel (status " + status + ").";
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (bound) {
            getContext().unbindService(connection);
            bound = false;
        }
        super.handleOnDestroy();
    }
}
