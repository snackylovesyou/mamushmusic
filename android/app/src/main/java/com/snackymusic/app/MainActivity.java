package com.snackymusic.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onPause() {
        super.onPause();
        
        // ¡EL HACK MAESTRO!: Cuando Android intenta pausar la app, 
        // forzamos al WebView (el reproductor) a mantenerse despierto.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }
}