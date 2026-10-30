import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useNavigate } from 'react-router-dom';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { closeTopOverlay } from '@/lib/backButton';

export const useNativeApp = () => {
  const navigate = useNavigate();
  const { open, closeAddMeal } = useAddMealSheet();
  const { theme } = useTheme();
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Style.Dark means light icons, for a dark background.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch((err) => {
      console.error('StatusBar plugin error:', err);
    });
  }, [theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNativeHooks = async () => {
      // 1. Let Android reserve space for the status bar instead of drawing over the webview
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (err) {
        console.error('StatusBar plugin error:', err);
      }

      // 2. Hardware Back Button Routing -- close the Add Meal sheet or the sidebar first if open
      CapacitorApp.addListener('backButton', () => {
        if (openRef.current) {
          closeAddMeal();
          return;
        }
        if (closeTopOverlay()) return;
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

      // 4. Tapping a habit reminder opens the Habits page
      LocalNotifications.addListener('localNotificationActionPerformed', () => navigate('/habits'));
    };

    initNativeHooks();

    return () => {
      // Cleanup listeners
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
        Keyboard.removeAllListeners();
        LocalNotifications.removeAllListeners();
      }
    };
    // Register the native listeners once: closeAddMeal is a new function each render, and the
    // back-button handler reads the sheet state through openRef instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
