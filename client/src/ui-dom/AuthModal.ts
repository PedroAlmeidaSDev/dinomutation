import { importGuestSave, signIn, type SignInResult } from '../game/core/save/session';
import { COLORS, FONT, hex } from '../game/ui/theme';
import { ApiError } from '../net/api';
import { GOOGLE_CLIENT_ID } from '../net/env';
import { loadGoogleIdentity } from './google';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  EMAIL_TAKEN: 'Já existe uma conta com este e-mail.',
  VALIDATION_ERROR: 'Confira os campos: e-mail válido, senha de 8 a 72 caracteres e nome de 2 a 40.',
  CONFLICT: 'Este e-mail já está ligado a outra conta Google.',
  NETWORK: 'Servidor indisponível. Tente de novo em instantes.',
};

/**
 * Sign-in / sign-up dialog in HTML over the canvas (Phaser has no text inputs). `onDone`
 * runs after a successful sign-in (and the optional import), even if the import step is
 * dismissed; `onClose` when dismissed before signing in.
 */
export class AuthModal {
  private readonly root: HTMLDivElement;
  private mode: 'login' | 'register' = 'login';
  private busy = false;
  /** Set once sign-in succeeded: dismissing the import step must still refresh the menu. */
  private signedIn = false;

  constructor(private readonly onDone: () => void, private readonly onClose: () => void) {
    injectStyles();
    this.root = document.createElement('div');
    this.root.className = 'dm-auth';
    // Keys typed here must not reach Phaser's window listeners (SPACE/ENTER start the game).
    for (const type of ['keydown', 'keyup'] as const) {
      this.root.addEventListener(type, (e) => {
        if (type === 'keydown' && e.key === 'Escape') this.close();
        e.stopPropagation();
      });
    }
    document.body.appendChild(this.root);
    this.renderForm();
  }

  close(): void {
    if (this.busy) return;
    this.root.remove();
    if (this.signedIn) this.onDone();
    else this.onClose();
  }

  private renderForm(): void {
    const register = this.mode === 'register';
    this.root.innerHTML = `
      <form class="dm-auth__panel" novalidate>
        <button type="button" class="dm-auth__close" aria-label="Fechar">×</button>
        <div class="dm-auth__tabs">
          <button type="button" data-mode="login" class="${register ? '' : 'is-active'}">ENTRAR</button>
          <button type="button" data-mode="register" class="${register ? 'is-active' : ''}">CRIAR CONTA</button>
        </div>
        ${register ? '<label>Nome<input name="displayName" autocomplete="nickname" maxlength="40" required></label>' : ''}
        <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
        <label>Senha<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" maxlength="72" required></label>
        ${register ? '<p class="dm-auth__note">Seu nome aparece no ranking público.</p>' : ''}
        <p class="dm-auth__error" role="alert"></p>
        <button type="submit" class="dm-auth__submit">${register ? 'CRIAR CONTA' : 'ENTRAR'}</button>
        <p class="dm-auth__note">Seu nome aparece no ranking público.</p>
        <div class="dm-auth__google"></div>
        <p class="dm-auth__note">Sem conta, o progresso fica só neste navegador.</p>
      </form>`;
    const form = this.root.querySelector('form')!;
    form.querySelector('.dm-auth__close')!.addEventListener('click', () => this.close());
    form.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode as 'login' | 'register';
        this.renderForm();
      }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') ?? '').trim();
      const password = String(data.get('password') ?? '');
      const name = String(data.get('displayName') ?? '').trim();
      void this.run(() => (this.mode === 'register' ? signIn.register(email, password, name) : signIn.password(email, password)));
    });
    this.mountGoogle(form.querySelector<HTMLElement>('.dm-auth__google')!);
    form.querySelector<HTMLInputElement>('input')?.focus();
  }

  private mountGoogle(el: HTMLElement): void {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogleIdentity()
      .then((gis) => {
        if (!el.isConnected) return;
        gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => void this.run(() => signIn.google(r.credential)) });
        gis.renderButton(el, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'pt-BR', width: 300 });
      })
      .catch(() => {
        el.textContent = 'Login com Google indisponível agora.';
      });
  }

  /** Runs a sign-in call with the dialog locked; on success offers the import or finishes. */
  private async run(action: () => Promise<SignInResult>): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.setError('');
    try {
      const result = await action();
      this.signedIn = true;
      this.setBusy(false);
      if (result.canImport) this.renderImport();
      else this.finish();
    } catch (e) {
      this.setBusy(false);
      this.setError(e instanceof ApiError ? MESSAGES[e.code] ?? e.message : 'Algo deu errado. Tente de novo.');
    }
  }

  private renderImport(): void {
    this.root.innerHTML = `
      <div class="dm-auth__panel">
        <h2>Importar progresso?</h2>
        <p>Este navegador tem progresso de visitante e a sua conta está vazia. Quer levar esse progresso para a conta?</p>
        <p class="dm-auth__error" role="alert"></p>
        <button type="button" class="dm-auth__submit" data-import="yes">IMPORTAR</button>
        <button type="button" class="dm-auth__ghost" data-import="no">COMEÇAR DO ZERO</button>
      </div>`;
    this.root.querySelector('[data-import="no"]')!.addEventListener('click', () => this.finish());
    this.root.querySelector('[data-import="yes"]')!.addEventListener('click', async () => {
      if (this.busy) return;
      this.setBusy(true);
      try {
        await importGuestSave();
        this.setBusy(false);
        this.finish();
      } catch {
        this.setBusy(false);
        this.setError('Não foi possível importar agora. A conta continua conectada.');
      }
    });
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    this.root.classList.toggle('is-busy', on);
  }

  private setError(message: string): void {
    const p = this.root.querySelector('.dm-auth__error');
    if (p) p.textContent = message;
  }

  private finish(): void {
    this.root.remove();
    this.onDone();
  }
}

let styled = false;

/** Styles derived from the game's theme (ui/theme.ts), injected once. */
function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
    .dm-auth { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
      background: rgba(15, 10, 9, 0.78); font-family: ${FONT}; user-select: text; -webkit-user-select: text; touch-action: auto; }
    .dm-auth.is-busy { cursor: progress; }
    .dm-auth.is-busy .dm-auth__panel { opacity: 0.7; pointer-events: none; }
    .dm-auth__panel { position: relative; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;
      width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 28px 24px 20px;
      background: ${hex(COLORS.panel)}; border: 1px solid ${hex(COLORS.border)}; color: ${COLORS.text}; }
    .dm-auth__panel h2 { margin: 0; font-size: 22px; }
    .dm-auth__panel p { margin: 0; color: ${COLORS.muted}; font-size: 14px; line-height: 1.4; }
    .dm-auth__tabs { display: flex; gap: 8px; }
    .dm-auth__tabs button { flex: 1; padding: 8px; background: none; border: 1px solid ${hex(COLORS.border)};
      color: ${COLORS.muted}; font: 700 14px ${FONT}; letter-spacing: 1px; cursor: pointer; }
    .dm-auth__tabs button.is-active { border-color: ${hex(COLORS.accent)}; color: ${COLORS.accentText}; }
    .dm-auth label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: ${COLORS.muted}; }
    .dm-auth input { padding: 10px; background: ${hex(COLORS.bg)}; border: 1px solid ${hex(COLORS.border)};
      color: ${COLORS.text}; font: 500 16px ${FONT}; }
    .dm-auth input:focus { outline: 2px solid ${hex(COLORS.accent)}; outline-offset: -1px; }
    .dm-auth__submit, .dm-auth__ghost { padding: 12px; font: 700 16px ${FONT}; letter-spacing: 1px; cursor: pointer; }
    .dm-auth__submit { background: ${hex(COLORS.accent)}; color: ${hex(COLORS.panel)}; border: none; }
    .dm-auth__ghost { background: none; border: 1px solid ${hex(COLORS.border)}; color: ${COLORS.text}; }
    .dm-auth .dm-auth__error { color: ${COLORS.danger}; min-height: 1em; }
    .dm-auth__google { display: flex; justify-content: center; }
    .dm-auth__close { position: absolute; top: 6px; right: 10px; background: none; border: none;
      color: ${COLORS.muted}; font-size: 26px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
