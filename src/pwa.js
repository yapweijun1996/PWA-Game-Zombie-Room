import { APP_VERSION, dom, pwaState, timers } from './state.js';
import { t } from './i18n.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function showInstallTip(message) {
  clearTimeout(timers.installTipTimer);
  dom.installTip.textContent = message;
  dom.installTip.classList.add('show');
  timers.installTipTimer = setTimeout(() => dom.installTip.classList.remove('show'), 5200);
}

function refreshInstallButton() {
  dom.installButton.classList.remove('ready', 'installed');
  dom.installButton.disabled = false;
  if (isStandalone()) {
    dom.installButton.classList.add('installed');
    dom.installButton.disabled = true;
    dom.installLabel.textContent = t('installed');
    dom.installButton.setAttribute('aria-label', t('installAriaInstalled'));
    return;
  }
  dom.installLabel.textContent = t('installLabel');
  dom.installButton.setAttribute('aria-label', t('installAriaInstall'));
  if (pwaState.deferredInstallPrompt || isIos()) dom.installButton.classList.add('ready');
}

function setUpdateState(mode, version = APP_VERSION) {
  clearTimeout(timers.updateResetTimer);
  dom.updateButton.classList.remove('available', 'checking');
  dom.updateButton.disabled = false;
  if (mode === 'available') {
    dom.updateButton.classList.add('available');
    dom.updateLabel.textContent = t('updateLabel', { version });
    dom.updateButton.setAttribute('aria-label', t('updateAriaInstall', { version }));
    return;
  }
  if (mode === 'checking') {
    dom.updateButton.classList.add('checking');
    dom.updateButton.disabled = true;
    dom.updateLabel.textContent = t('updateChecking', { version: APP_VERSION });
    return;
  }
  if (mode === 'updating') {
    dom.updateButton.classList.add('checking');
    dom.updateButton.disabled = true;
    dom.updateLabel.textContent = t('updateUpdating', { version });
    return;
  }
  dom.updateLabel.textContent = t('updateLabel', { version: APP_VERSION });
  dom.updateButton.setAttribute('aria-label', t('updateAriaCheck', { version: APP_VERSION }));
}

function getWorkerVersion(worker) {
  return new Promise(resolve => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 900);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      resolve(event.data && event.data.version ? event.data.version : null);
    };
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch (_) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function exposeWaitingWorker(worker) {
  if (!worker) return;
  pwaState.waitingWorker = worker;
  const version = await getWorkerVersion(worker) || 'new';
  setUpdateState('available', version);
}

async function registerPwa() {
  setUpdateState('idle');
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    pwaState.swRegistration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    if (pwaState.swRegistration.waiting) await exposeWaitingWorker(pwaState.swRegistration.waiting);

    pwaState.swRegistration.addEventListener('updatefound', () => {
      const worker = pwaState.swRegistration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', async () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          await exposeWaitingWorker(worker);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      location.reload();
    });

    setTimeout(() => pwaState.swRegistration && pwaState.swRegistration.update().catch(() => {}), 1500);
  } catch (_) {
    setUpdateState('idle');
  }
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pwaState.deferredInstallPrompt = event;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    pwaState.deferredInstallPrompt = null;
    refreshInstallButton();
    showInstallTip(t('installTipInstalled'));
  });

  dom.installButton.addEventListener('click', async () => {
    if (isStandalone()) return;
    if (pwaState.deferredInstallPrompt) {
      const promptEvent = pwaState.deferredInstallPrompt;
      pwaState.deferredInstallPrompt = null;
      dom.installLabel.textContent = t('installing');
      dom.installButton.disabled = true;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (!choice || choice.outcome !== 'accepted') {
          showInstallTip(t('installTipCancelled'));
        }
      } catch (_) {
        showInstallTip(t('installTipUnavailable'));
      }
      refreshInstallButton();
      return;
    }
    if (isIos()) {
      showInstallTip(t('installTipIos'));
    } else {
      showInstallTip(t('installTipBrowser'));
    }
  });

  dom.updateButton.addEventListener('click', async () => {
    if (pwaState.waitingWorker) {
      const nextVersion = await getWorkerVersion(pwaState.waitingWorker) || 'new';
      setUpdateState('updating', nextVersion);
      pwaState.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    if (!pwaState.swRegistration) {
      setUpdateState('checking');
      await registerPwa();
      timers.updateResetTimer = setTimeout(() => {
        if (!pwaState.waitingWorker) setUpdateState('idle');
      }, 1000);
      return;
    }
    setUpdateState('checking');
    try { await pwaState.swRegistration.update(); } catch (_) {}
    timers.updateResetTimer = setTimeout(() => {
      if (!pwaState.waitingWorker) setUpdateState('idle');
    }, 1200);
  });

  refreshInstallButton();
  setUpdateState('idle');
  registerPwa();
}

export function refreshPwaLabels() {
  refreshInstallButton();
  if (pwaState.waitingWorker) {
    getWorkerVersion(pwaState.waitingWorker).then(version => setUpdateState('available', version || 'new'));
  } else if (!dom.updateButton.classList.contains('checking')) {
    setUpdateState('idle');
  }
}
