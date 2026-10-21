import React, { useCallback, type ReactNode } from 'react';
import {
  KidAgeGate, KidAgeGateError, KidAgeGateFail, KidAgeGatePass, KidAgeGatePending, KidAgeGateProhibited,
  KidCoreProvider, KidPermission, KidSessionProvider, KidSettings, KidSettingsProvider, useKidSession,
} from '@k-id/core';

// k-ID age gate for the companion (spec sections 5–6). The widget handles age capture,
// jurisdiction and parental consent; our backend still enforces every protected feature.

// Publishable key: k-ID designs it to ship in the browser. It still lives only in the
// git-ignored root .env (VITE_KID_PUBLISHABLE_KEY) so it never lands in the public repo.
const publishableKey = import.meta.env.VITE_KID_PUBLISHABLE_KEY as string | undefined;
// Must be k-ID's own host: calls are signed for this exact URL and can't be proxied.
const baseUrl = (import.meta.env.VITE_KID_BASE_URL as string | undefined) || 'https://kai-api.test.k-id.com/fapi/v1';
// Required by k-ID; shown to parents and players in k-ID's emails. Set in .env, not in code.
const supportEmail = import.meta.env.VITE_KID_SUPPORT_EMAIL as string | undefined;

// Only features Ozone Layer really has (names from the SDK's PERMISSIONS.md):
// typed coaching (W06), spoken coaching (W07/W08) and parent-approved purchases (W14).
// Privacy/terms/icon are left out on purpose, so k-ID keeps its defaults in test mode.
export const declaredPermissions = [{ name: 'ai-chat' }, { name: 'ai-voice-mode' }, { name: 'in-game-purchases' }] as const;

// Resume an in-flight flow on the next launch. Storage can be unavailable (private mode),
// so every access is guarded; losing these only means the player starts the gate again.
const keys = { session: 'ozone.kid.sessionId', challenge: 'ozone.kid.challengeId', settingsChallenge: 'ozone.kid.settingsChallengeId' };
const read = (key: string) => { try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; } };
const write = (key: string, value: string | null) => { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* storage unavailable */ } };

// Hand the one-time claim token to our backend straight away (valid for 10 minutes).
async function sendClaim(claimToken: string) {
  try {
    await fetch('/api/kid/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimToken }) });
  } catch { /* the backend records the blocker; the gate result itself is unaffected */ }
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return <div className="app"><main className="kid-gate"><section className="kid-notice" role="status"><h1>{title}</h1>{children}</section></main></div>;
}

export function KidRoot({ children }: { children: ReactNode }) {
  const onSession = useCallback((sessionId: string) => { write(keys.session, sessionId); write(keys.challenge, null); }, []);
  const onChallenge = useCallback((challengeId: string) => write(keys.challenge, challengeId), []);
  if (!publishableKey || !supportEmail) {
    return <Notice title="k-ID isn't set up on this machine">
      <p>Add <code>VITE_KID_PUBLISHABLE_KEY</code> and <code>VITE_KID_SUPPORT_EMAIL</code> to the root <code>.env</code>, then restart <code>npm run dev</code>. See the README's k-ID section.</p>
    </Notice>;
  }
  return <KidCoreProvider publishableKey={publishableKey} baseUrl={baseUrl}
    declare={{ permissions: [...declaredPermissions], supportEmail }}
    appearance={{ variables: { colorPrimary: '#123f37', radius: '14px', fontFamily: 'inherit' } }}>
    <KidSessionProvider jurisdiction="auto" sessionId={read(keys.session)} challengeId={read(keys.challenge)}
      onSession={onSession} onChallenge={onChallenge} onClaim={sendClaim}>
      <div className="kid-gate"><KidAgeGate>
        <KidAgeGatePending><Notice title="Waiting for a grown-up">
          <p>We emailed a parent or guardian to approve. You can close this page; it picks up where you left off.</p>
        </Notice></KidAgeGatePending>
        <KidAgeGateProhibited><Notice title="Not available yet">
          <p>Ozone Layer isn't available at this age where you live. A trusted adult can help you stay safe online.</p>
        </Notice></KidAgeGateProhibited>
        <KidAgeGateFail><Notice title="Approval didn't go through">
          <p>The request was declined or expired. Ask a grown-up and try again later.</p>
          <button onClick={() => { write(keys.challenge, null); location.reload(); }}>Start over</button>
        </Notice></KidAgeGateFail>
        <KidAgeGateError><Notice title="Couldn't reach k-ID">
          <p>Check your connection, then reload the page.</p>
          <button onClick={() => location.reload()}>Reload</button>
        </Notice></KidAgeGateError>
        <KidAgeGatePass>{children}</KidAgeGatePass>
      </KidAgeGate></div>
    </KidSessionProvider>
  </KidCoreProvider>;
}

// What this player may see. Visibility only: the backend must still check each capability.
export function KidFeatures() {
  const { sessionId } = useKidSession();
  const off = (text: string) => <p className="kid-off">{text}</p>;
  return <section className="status-panel kid-features" aria-labelledby="kid-features-title">
    <div><p className="eyebrow">04 / YOUR FEATURES</p><h2 id="kid-features-title">Set by k-ID for you.</h2>
      <p>Based on your age, where you live and a grown-up's choices. Change them in settings below.</p></div>
    <ul>
      <li><strong>Typed coaching</strong><KidPermission name="ai-chat" fallback={off('Off. Pre-written lessons still work.')}><p>On</p></KidPermission></li>
      <li><strong>Spoken coaching</strong><KidPermission name="ai-voice-mode" fallback={off('Off. Text and captions still work.')}><p>On</p></KidPermission></li>
      <li><strong>Purchases</strong><KidPermission name="in-game-purchases" fallback={off('Off. Nothing can be bought.')}><p>On, with a parent's rules</p></KidPermission></li>
    </ul>
    {sessionId && <div className="kid-settings"><h3>Settings</h3>
      <KidSettingsProvider sessionId={sessionId} challengeId={read(keys.settingsChallenge)} onChallenge={id => write(keys.settingsChallenge, id)}><KidSettings /></KidSettingsProvider>
    </div>}
  </section>;
}
