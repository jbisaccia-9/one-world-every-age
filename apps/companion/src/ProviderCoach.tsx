import React, { useEffect, useRef, useState } from 'react';
import { coachingResponseSchema, ownedAssessmentResponseSchema, purchaseResultSchema, sessionViewSchema, voiceResultSchema, type DemoRequest } from '@beacon/contracts';
import { openSession, type Client } from './demo-client';

type Session = ReturnType<typeof sessionViewSchema.parse>;
type Stage = 'idle' | 'checking' | 'microphone' | 'recording' | 'processing' | 'playing' | 'ready' | 'text' | 'stopped';
const susanQuestion = 'But what if it’s real? I don’t want a late fee.';
const stageText: Record<Stage, string> = {
  idle: 'Microphone off. No background listening.',
  checking: 'Checking whether spoken coaching is available. Microphone off.',
  microphone: 'Waiting for microphone permission. Choose Allow to record this question.',
  recording: 'Recording · microphone on. Select Send when finished, or Stop to discard. Maximum 15 seconds.',
  processing: 'Microphone off. Preparing your coaching and matching captions…',
  playing: 'Playing coaching. The same words appear in the captions.',
  ready: 'Microphone off. Coaching is ready.',
  text: 'Microphone off. Continue with text.',
  stopped: 'Microphone and playback off.',
};

export function ProviderCoach({ fixtureId, variant }: Pick<DemoRequest, 'fixtureId' | 'variant'>) {
  const client = useRef<Client | null>(null), generation = useRef(0), mounted = useRef(false);
  const turn = useRef<string | null>(null), recording = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), pending = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null), audioUrl = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null), [assessmentId, setAssessment] = useState('');
  const [consent, setConsent] = useState(false), [message, setMessage] = useState(''), [diagnostic, setDiagnostic] = useState('');
  const [captions, setCaptions] = useState(''), [busy, setBusy] = useState(false), [stage, setStage] = useState<Stage>('idle');
  const [question, setQuestion] = useState(fixtureId === 'P10' ? susanQuestion : 'What is the safer way to check this fictional message?');
  const [checkout, setCheckout] = useState(''), [audioReady, setAudioReady] = useState(false);
  const isCurrent = (id: number, current: Client) => id === generation.current && current === client.current;

  function discardAudio() {
    if (player.current) {
      player.current.onended = null; player.current.onerror = null;
      player.current.pause(); player.current.removeAttribute('src'); player.current.load(); player.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }
  function cancelTurn(current: Client, turnId: string, id: number) {
    void current.request(`/api/voice/turns/${turnId}/cancel`, {}).catch(() => {
      if (mounted.current && id === generation.current) setDiagnostic('Server cancellation could not be confirmed. Local microphone and playback are off; late results are discarded.');
    });
  }
  function halt() {
    const id = ++generation.current;
    pending.current?.abort(); pending.current = null;
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    if (recording.current) {
      recording.current.ondataavailable = null; recording.current.onerror = null; recording.current.onstop = null;
      if (recording.current.state !== 'inactive') recording.current.stop();
    }
    recording.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    discardAudio();
    const turnId = turn.current; turn.current = null;
    if (turnId && client.current) cancelTurn(client.current, turnId, id);
    return id;
  }
  function stop() {
    halt(); setAudioReady(false); setBusy(false); setStage('stopped');
    setMessage('Stopped. Microphone and playback are off. Late responses are discarded. Text is still available.');
  }
  function changeConsent(value: boolean) {
    setConsent(value);
    if (!client.current && !busy) return;
    halt(); client.current?.close(); client.current = null;
    setSession(null); setAssessment(''); setCheckout(''); setAudioReady(false); setBusy(false); setStage('stopped');
    setMessage('Consent updated. Microphone and playback are off. The explanation above is still available.');
    setDiagnostic('Consent changed. Start a new server-owned test session to use the updated choice.');
  }
  useEffect(() => {
    mounted.current = true;
    window.addEventListener('pagehide', stop);
    return () => {
      mounted.current = false; window.removeEventListener('pagehide', stop);
      halt(); client.current?.close(); client.current = null;
    };
  }, []);

  function begin(next: Stage) {
    const id = halt(), controller = new AbortController();
    pending.current = controller; setAudioReady(false); setBusy(true); setStage(next); setMessage('');
    return { id, controller };
  }
  async function context(ready: Session, current: Client, id: number, signal: AbortSignal) {
    if (!isCurrent(id, current)) return;
    setSession(ready);
    const owned = ownedAssessmentResponseSchema.parse(await current.request('/api/assessments', { contextVersion: ready.contextVersion, fixtureId, variant }, signal));
    if (isCurrent(id, current)) setAssessment(owned.assessment.id);
  }
  async function connect() {
    const { id, controller } = begin('idle');
    client.current?.close(); client.current = null;
    setSession(null); setCheckout(''); setAssessment(''); setCaptions('');
    setDiagnostic('Creating a separate server-owned provider test session…');
    try {
      const current = await openSession('provider-test', 'adult', consent);
      if (id !== generation.current) { current.close(); return; }
      client.current = current;
      await context(current.session, current, id, controller.signal);
      if (!isCurrent(id, current)) return;
      setDiagnostic('Server-owned k-ID CDK Test Mode session created. All protected requests still require current server permission checks.');
    } catch (e) {
      if (id === generation.current) setMessage(e instanceof Error ? e.message : 'Spoken coaching setup is unavailable. Continue with the explanation above.');
    } finally { if (id === generation.current) { pending.current = null; setBusy(false); } }
  }
  async function refresh() {
    const current = client.current, ready = session;
    if (!current || !ready) return;
    const { id, controller } = begin('idle');
    setAssessment(''); setCaptions(''); setCheckout('');
    try {
      const { changed: _, ...view } = await current.request('/api/onboarding/refresh', { contextVersion: ready.contextVersion }, controller.signal);
      if (!isCurrent(id, current)) return;
      await context(sessionViewSchema.parse(view), current, id, controller.signal);
      if (isCurrent(id, current)) setDiagnostic('Permissions refreshed from the bound provider session; a current owned assessment was created.');
    } catch (e) {
      if (isCurrent(id, current)) setMessage(e instanceof Error ? e.message : 'Permission refresh is unavailable. Continue with the explanation above.');
    } finally { if (isCurrent(id, current)) { pending.current = null; setBusy(false); } }
  }
  async function ask() {
    const current = client.current, ready = session;
    if (!current || !ready || !assessmentId || !question.trim() || busy) return;
    const { id, controller } = begin('processing'); setCaptions('');
    try {
      const result = coachingResponseSchema.parse(await current.request('/api/coaching/questions', { assessmentId, contextVersion: ready.contextVersion, question }, controller.signal));
      if (!isCurrent(id, current)) return;
      if (result.contextVersion !== ready.contextVersion) throw new Error('The coaching context changed. Refresh permissions before trying again.');
      setCaptions(result.reply.explanation); setDiagnostic(result.notice); setStage('text');
      setMessage('Your coaching is ready to read below.');
    } catch (e) {
      if (isCurrent(id, current)) { setStage('text'); setMessage(e instanceof Error ? e.message : 'Text coaching is unavailable. Continue with the explanation above.'); }
    } finally { if (isCurrent(id, current)) { pending.current = null; setBusy(false); } }
  }
  async function play(id = generation.current) {
    const output = player.current;
    if (!output || !audioUrl.current || id !== generation.current) return;
    setBusy(true); setStage('playing'); setMessage('');
    if (output.ended) output.currentTime = 0;
    try { await output.play(); }
    catch (e) {
      if (id !== generation.current || output !== player.current) return;
      setStage('ready'); setBusy(false);
      setMessage(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Your browser paused playback. Select Play to hear the coaching, or read the matching captions.'
        : 'Audio could not play. Try Play again, or read the matching captions.');
    }
  }
  async function talk() {
    const current = client.current, ready = session;
    if (!current || !ready || !assessmentId || !consent || busy) return;
    const { id, controller } = begin('checking'); setCaptions('');
    try {
      // Browser microphone permission is separate from the server's eligibility checks.
      const started = await current.request('/api/voice/turns', { assessmentId, contextVersion: ready.contextVersion, adultPresenterConsent: true }, controller.signal);
      if (!isCurrent(id, current)) {
        if (typeof started.turnId === 'string') cancelTurn(current, started.turnId, id);
        return;
      }
      if (typeof started.turnId !== 'string' || !/^[0-9a-f-]{36}$/i.test(started.turnId)) throw new Error('The voice session could not be prepared. Use text or the explanation above.');
      const turnId = started.turnId; turn.current = turnId;
      if (started.contextVersion !== ready.contextVersion || started.stage !== 'ready') throw new Error('The voice context changed. Refresh permissions before trying again.');
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. Use the text question or the explanation above.');
      setStage('microphone');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!isCurrent(id, current)) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('No supported recorder format is available. Use the text question or the explanation above.');
      const recorder = new MediaRecorder(media, { mimeType: mime }), chunks: Blob[] = [];
      let size = 0, began = 0, durationMs = 0;
      recording.current = recorder;
      recorder.ondataavailable = event => {
        if (!isCurrent(id, current)) return;
        size += event.data.size;
        if (size > 2 * 1024 * 1024) { chunks.length = 0; stop(); setMessage('Recording exceeded 2 MiB and was discarded. Use the text question.'); }
        else if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (!isCurrent(id, current)) return;
        chunks.length = 0; stop(); setMessage('The microphone recording failed. Continue with the text question or the explanation above.');
      };
      recorder.onstop = async () => {
        media.getTracks().forEach(track => track.stop());
        if (!isCurrent(id, current)) { chunks.length = 0; return; }
        if (stream.current === media) stream.current = null;
        if (recording.current === recorder) recording.current = null;
        if (timer.current) clearTimeout(timer.current); timer.current = null;
        durationMs = Math.max(1, Math.min(15000, Math.round(performance.now() - began)));
        if (!chunks.length) { stop(); setMessage('No audio was captured. Continue with the text question or the explanation above.'); return; }
        setStage('processing');
        try {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); chunks.length = 0;
          if (!isCurrent(id, current)) { bytes.fill(0); return; }
          let binary = ''; for (const value of bytes) binary += String.fromCharCode(value); bytes.fill(0);
          const audioBase64 = btoa(binary); binary = '';
          const response = voiceResultSchema.parse(await current.request(`/api/voice/turns/${turnId}`, { contextVersion: ready.contextVersion, mimeType: mime.split(';')[0], durationMs, audioBase64 }, controller.signal));
          if (!isCurrent(id, current)) return;
          if (response.turnId !== turnId || response.contextVersion !== ready.contextVersion) throw new Error('The voice context changed. The response was discarded; refresh permissions to continue.');
          turn.current = null; pending.current = null;
          setCaptions(response.reply.spokenText); setDiagnostic(response.notice);
          if (!response.audioBase64) {
            setStage('text'); setBusy(false);
            setMessage(response.speechUnavailable ?? 'Speech is unavailable. Read the matching captions.');
            return;
          }
          const audio = Uint8Array.from(atob(response.audioBase64), char => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([audio], { type: response.mimeType ?? 'audio/mpeg' })); audio.fill(0);
          audioUrl.current = url;
          const output = new Audio(url); player.current = output; setAudioReady(true);
          output.onerror = () => {
            if (!isCurrent(id, current) || player.current !== output) return;
            discardAudio(); setAudioReady(false); setBusy(false); setStage('text');
            setMessage('Audio could not play. Read the matching captions.');
          };
          output.onended = () => {
            if (!isCurrent(id, current) || player.current !== output) return;
            setStage('ready'); setBusy(false); setMessage('Finished. Read the captions or select Play to hear the coaching again.');
          };
          // Keep the transient audio available for an explicit Play if autoplay is denied.
          await play(id);
        } catch (e) {
          if (isCurrent(id, current)) { stop(); setStage('text'); setMessage(e instanceof Error ? e.message : 'Voice coaching failed. Continue with the text question or the explanation above.'); }
        }
      };
      began = performance.now(); recorder.start(250); setStage('recording');
      setMessage('Recording this fictional question only. Select Send when you finish.');
      timer.current = setTimeout(() => { if (isCurrent(id, current) && recorder.state !== 'inactive') recorder.stop(); }, 15000);
    } catch (e) {
      if (isCurrent(id, current)) {
        stop(); setStage('text');
        setMessage(e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access denied. Nothing is recording. Use the text question or the explanation above.'
          : e instanceof Error ? e.message : 'Voice coaching is unavailable. Use the text question or the explanation above.');
      }
    }
  }
  async function purchase() {
    const current = client.current, ready = session;
    if (!current || !ready || !assessmentId || busy) return;
    const { id, controller } = begin('idle'); setCheckout('');
    try {
      const result = purchaseResultSchema.parse(await current.request('/api/purchases', { assessmentId, contextVersion: ready.contextVersion, itemId: 'ozone-theme', idempotencyKey: crypto.randomUUID() }, controller.signal));
      if (!isCurrent(id, current)) return;
      setDiagnostic(result.reason);
      if (result.state === 'checkout_ready' && result.checkoutUrl) setCheckout(result.checkoutUrl);
    } catch (e) {
      if (isCurrent(id, current)) setDiagnostic(e instanceof Error ? e.message : 'Checkout is unavailable.');
    } finally { if (isCurrent(id, current)) { pending.current = null; setBusy(false); } }
  }

  return <section className="demo-extra provider-coach" aria-label="Spoken and typed coaching">
    <p className="eyebrow">{fixtureId === 'P10' ? 'SUSAN’S QUESTION' : 'YOUR NEXT QUESTION'}</p>
    <h2>Talk it through</h2>
    {fixtureId === 'P10' && <p className="susan-concern">“{susanQuestion}”</p>}
    <p>Record one fictional question, or type it below. You can always read the explanation above. Recording starts only when you choose Talk it through and stops after 15 seconds.</p>
    <label><input type="checkbox" checked={consent} onChange={event => changeConsent(event.target.checked)}/> I am a consenting adult presenter. Enable cloud analysis and spoken coaching for fictional test questions.</label>
    <div role="group" aria-label="Spoken coaching controls">
      <button disabled={busy || !assessmentId || !consent} onClick={() => void talk()}>Talk it through</button>
      <button disabled={stage !== 'recording'} onClick={() => { if (recording.current?.state === 'recording') { setStage('processing'); recording.current.stop(); } }}>Send</button>
      <button disabled={!audioReady || busy} onClick={() => void play()}>Play</button>
      <button onClick={stop}>Stop</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{stageText[stage]}</p>
    <p role="status" aria-live="polite" aria-atomic="true" data-testid="provider-message">{message}</p>
    {captions && <section className="captions" role="region" aria-label="Coach captions"><h3>Coach captions</h3><p aria-live="polite" aria-atomic="true">{captions}</p></section>}
    <label>Fictional text question<input value={question} maxLength={2000} onChange={event => setQuestion(event.target.value)}/></label>
    <button disabled={busy || !assessmentId || !question.trim()} onClick={() => void ask()}>Ask using text</button>
    <details>
      <summary>Developer test setup</summary>
      <p>This separate server-created k-ID CDK Test Mode session uses synthetic evidence. The optional browser widget and standalone provider diagnostics grant no application access. The server checks eligibility before any microphone prompt and rechecks permissions throughout the Modulate → Gemini → Inworld turn.</p>
      <button disabled={busy} onClick={() => void connect()}>Start server-owned provider test</button>
      {session && <>
        <p>{session.onboardingState} · context {session.contextVersion} · mapping {session.provider.mappingConfirmed ? 'confirmed' : 'unconfirmed'}</p>
        {session.challenge && <a href={session.challenge.url} target="_blank" rel="noreferrer">Open genuine k-ID Test Mode challenge</a>}
        <button disabled={busy} onClick={() => void refresh()}>Refresh provider permissions</button>
        <button disabled={busy || !assessmentId} onClick={() => void purchase()}>Request optional Ozone theme · $1 sandbox</button>
        {checkout && <a href={checkout} target="_blank" rel="noreferrer">Open eligible adult hosted test checkout</a>}
      </>}
      <p role="status" aria-live="polite" data-testid="provider-diagnostic">{diagnostic}</p>
      <p className="note">Parent-approved saved-method purchases remain blocked until W14 prerequisites are verified. The optional theme never unlocks protection, lessons or badges.</p>
    </details>
  </section>;
}
