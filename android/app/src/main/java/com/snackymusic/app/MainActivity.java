package com.mamushmusic.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onPause() {
        super.onPause();
        
        // Forma segura de mantener el navegador activo para que YouTube no se corte
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }
}