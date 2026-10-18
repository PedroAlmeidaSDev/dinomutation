import { ApiError, api, onSessionLost, refreshSession, setAccessToken } from '../../../net/api';
import { API_ENABLED } from '../../../net/env';
import type { Account, SaveDto, TokenResponse } from './apiTypes';
import { CloudSaveStore } from './CloudSaveStore';
import { LocalSaveStore } from './LocalSaveStore';
import { saveStore, setSaveStore } from './SaveStore';

/** The refresh cookie is httpOnly, so this flag is how the game knows a session may exist. */
const FLAG = 'dino-logged-in';

/** 'superseded': the store changed while resuming (the player signed in meanwhile); nothing was touched. */
export type ResumeResult = 'cloud' | 'guest' | 'offline' | 'superseded';

export interface SignInResult {
  account: Account;
  /** The browser has guest progress and the account has none: offer to import it. */
  canImport: boolean;
}

/** On boot: picks up the session of the last visit, if there was one. */
export async function resumeSession(enabled = API_ENABLED): Promise<ResumeResult> {
  if (!enabled || !hasLoginFlag()) return 'guest';
  // A slow API lets the player go on as a guest and sign in meanwhile: a late answer must not
  // replace (or end) that newer session.
  const initial = saveStore();
  const superseded = () => saveStore() !== initial;
  const refreshed = await refreshSession();
  if (superseded()) return 'superseded';
  if (refreshed === 'expired') {
    endLocalSession();
    return 'guest';
  }
  if (refreshed === 'offline') return 'offline';
  try {
    const cloud = await CloudSaveStore.open();
    if (superseded()) return 'superseded';
    setSaveStore(cloud);
    return 'cloud';
  } catch (e) {
    if (superseded()) return 'superseded';
    if (e instanceof ApiError && (e.offline || e.status >= 500)) return 'offline';
    endLocalSession();
    return 'guest';
  }
}

export const signIn = {
  password: (email: string, password: string) =>
    start(api<TokenResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false })),
  register: (email: string, password: string, displayName: string) =>
    start(api<TokenResponse>('/auth/register', { method: 'POST', body: { email, password, displayName }, auth: false })),
  google: (idToken: string) =>
    start(api<TokenResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false })),
};

async function start(tokens: Promise<TokenResponse>): Promise<SignInResult> {
  setAccessToken((await tokens).accessToken);
  try {
    setLoginFlag();
    const guest = new LocalSaveStore().current();
    const cloud = await CloudSaveStore.open();
    setSaveStore(cloud);
    return { account: cloud.account, canImport: guest.runs > 0 && cloud.current().runs === 0 };
  } catch (e) {
    endLocalSession();
    throw e;
  }
}

/** Copies the guest save into the (empty) account. ALREADY_IMPORTED means the cloud wins. */
export async function importGuestSave(): Promise<void> {
  try {
    const dto = await api<SaveDto>('/players/me/import', { method: 'POST', body: { save: new LocalSaveStore().current() } });
    setSaveStore(CloudSaveStore.from(dto));
  } catch (e) {
    if (!(e instanceof ApiError && e.code === 'ALREADY_IMPORTED')) throw e;
  }
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
  endLocalSession();
}

export function currentAccount(): Account | null {
  const s = saveStore();
  return s instanceof CloudSaveStore ? s.account : null;
}

export function hasLoginFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function setLoginFlag(): void {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // storage unavailable: the session just won't be resumed next time
  }
}

/** Forgets the session here; the browser's guest save is never touched. */
function endLocalSession(): void {
  setAccessToken(null);
  try {
    localStorage.removeItem(FLAG);
  } catch {
    // ignore
  }
  setSaveStore(new LocalSaveStore());
}

// The API gave up on the session mid-game (refresh token revoked or expired): back to guest.
onSessionLost(() => {
  console.warn('Sessão expirada; voltando ao modo visitante.');
  endLocalSession();
});
