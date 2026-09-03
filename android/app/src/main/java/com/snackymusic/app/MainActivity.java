package com.mamushmusic.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onPause() {
        super.onPause();
        
        // HACK A NIVEL DE SISTEMA: Evitar que Android y YouTube pausen el reproductor
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            
            // 1. Reactivar forzosamente los procesos y temporizadores del navegador interno
            webView.onResume();
            webView.resumeTimers();
            
            // 2. Engañar a la API de YouTube interceptando el evento de cambio de visibilidad
            // Obligamos al sistema a reportar que la ventana sigue visible (View.VISIBLE)
            try {
                webView.getClass().getMethod("dispatchWindowVisibilityChanged", int.class).invoke(webView, View.VISIBLE);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}