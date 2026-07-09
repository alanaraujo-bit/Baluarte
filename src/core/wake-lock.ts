/**
 * Screen Wake Lock — impede que a tela do dispositivo desligue
 * enquanto o jogo estiver rodando.
 *
 * Usa a API nativa `navigator.wakeLock.request('screen')`.
 * Falha silenciosamente em browsers que não suportam.
 *
 * Re-adquire automaticamente quando a aba volta a ficar visível
 * (navegadores liberam o wake lock ao ocultar a aba).
 */

let wakeLock: WakeLockSentinel | null = null;
let visibilityHandler: (() => void) | null = null;
let active = false;

/** Solicita que a tela não desligue enquanto o jogo estiver aberto. */
export async function acquireWakeLock(): Promise<void> {
  if (active) return; // já ativo
  active = true;

  await requestLock();

  // Re-adquire quando a aba voltar a ficar visível (a API libera
  // automaticamente ao ocultar a aba no Android/iOS).
  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
}

/** Libera o wake lock. */
export function releaseWakeLock(): void {
  active = false;
  releaseLock();
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

// — helpers — //

async function requestLock(): Promise<void> {
  // Se já tem um lock ativo, não precisa pedir de novo.
  if (wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakeLock = lock;
    lock.addEventListener('release', () => {
      // Só anula se este sentinela ainda for o ativo — evita que
      // um evento release atrasado de um sentinela antigo anule
      // um sentinela novo adquirido entre a chamada release() e
      // a resolução da Promise.
      if (wakeLock === lock) wakeLock = null;
    });
  } catch {
    // Wake Lock API não suportada ou permissão negada — falha silenciosa.
    // Num jogo isso não é crítico; só perde a função de não apagar a tela.
  }
}

function releaseLock(): void {
  if (!wakeLock) return;
  try {
    wakeLock.release();
  } catch {
    // ignora
  }
  wakeLock = null;
}
