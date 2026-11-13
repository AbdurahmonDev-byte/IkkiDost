declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        colorScheme?: 'light' | 'dark';
        ready: () => void;
        expand: () => void;
        close: () => void;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
      };
    };
  }
}

export const tg = {
  get app() {
    return window.Telegram?.WebApp;
  },

  init() {
    this.app?.ready();
    this.app?.expand();
  },

  haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    try {
      this.app?.HapticFeedback?.impactOccurred(type);
    } catch {
      // ignore
    }
  },

  selection() {
    try {
      this.app?.HapticFeedback?.selectionChanged();
    } catch {
      // ignore
    }
  },

  hapticSuccess() {
    try {
      this.app?.HapticFeedback?.notificationOccurred('success');
    } catch {
      // ignore
    }
  },

  get user() {
    return this.app?.initDataUnsafe?.user;
  },

  get startParam() {
    return this.app?.initDataUnsafe?.start_param;
  },

  /** Opens a t.me link inside Telegram when possible. */
  openTelegram(url: string) {
    if (this.app?.openTelegramLink) this.app.openTelegramLink(url);
    else window.open(url, '_blank');
  },

  alert(message: string) {
    if (this.app?.showAlert) this.app.showAlert(message);
    else window.alert(message);
  },
};
