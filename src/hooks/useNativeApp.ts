import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

export const useNativeApp = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNativeHooks = async () => {
      // 1. Configure Status Bar to overlay the webview transparently
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (err) {
        console.error('StatusBar plugin error:', err);
      }

      // 2. Hardware Back Button Routing
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (window.history.state && window.history.state.idx > 0) {
          window.history.back();
        } else {
          CapacitorApp.exitApp();
        }
      });

      // 3. Prevent layout shifting behind keyboard by allocating padding
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.style.paddingBottom = `${info.keyboardHeight}px`;
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.style.paddingBottom = '0px';
      });
    };

    initNativeHooks();

    return () => {
      // Cleanup listeners
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
        Keyboard.removeAllListeners();
      }
    };
  }, []);
};
