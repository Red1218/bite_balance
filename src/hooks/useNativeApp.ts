import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

export const useNativeApp = () => {
  const { open, closeAddMeal } = useAddMealSheet();
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNativeHooks = async () => {
      // 1. Let Android reserve space for the status bar instead of drawing over the webview
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (err) {
        console.error('StatusBar plugin error:', err);
      }

      // 2. Hardware Back Button Routing -- close the Add Meal sheet first if it's open
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (openRef.current) {
          closeAddMeal();
          return;
        }
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
