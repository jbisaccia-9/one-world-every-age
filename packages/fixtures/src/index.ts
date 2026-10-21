import { capabilityNames, demoRequestSchema, demoResponseSchema, fixtureSchema, providerStatusSchema, publicChallengeSchema, type DemoRequest } from '@beacon/contracts';
import { describeUrl } from '@beacon/detection';

// Public browser-safe data only. The server rubric lives in the separate ./server export.
export const baselineChallenge = publicChallengeSchema.parse({
  id: 'address-and-request', version: 1, credit_key: 'credential-evidence-01', category: 'privacy',
  question: 'Which observation deserves a closer look before you enter anything?',
  choices: [
    { id: 'address-request', text: 'The address and what the page asks me to share' },
    { id: 'logo', text: 'Whether the page has a familiar logo' },
    { id: 'color', text: 'Whether I like the page colors' },
  ],
});
const uncertain = 'This is a pre-authored synthetic fixture, not live scanning. An absence of supported indicators never verifies a page as safe.';
export const baselineFixtures = [
  { id: 'P01', variant: 'baseline', title: 'The free reward offer', illustrativeUrl: 'https://roblox.com.gifts-check.example/reward', text: 'I can give you free credits. Open this link, buy the verification pack, and don’t tell your parents. Free game rewards! Enter your game password and one-time sign-in code to claim your gift.', expectedState: 'concern-found', expectedSeverity: 'high-concern', explanation: 'The offer asks Jimmy to keep a secret from his parents and pay for a verification pack to receive supposedly free credits. Those requests deserve a pause, whatever the price. This synthetic page also requests a game password and a sign-in code. The brand-like text is before the actual gifts-check.example domain; a familiar name or logo does not establish who runs a page.', safeAction: 'Pause before opening the offer or buying anything. Tell a trusted adult. Keep passwords and codes private, and open the game through your usual app or independently known address.' },
  { id: 'P01', variant: 'safe', title: 'Keep your reward credentials private', illustrativeUrl: 'https://learning.example/rewards', text: 'A game reward never needs your password or sign-in code. Ask for help if an offer requests either.', expectedState: 'no-supported-indicators', expectedSeverity: 'informational', explanation: 'This educational example advises against sharing credentials. Quoting a risky request while teaching safety is different from making that request.', safeAction: 'Continue using independently known game channels; never share sign-in codes.' },
  { id: 'P01', variant: 'ambiguous', title: 'A reward with missing details', illustrativeUrl: 'https://offer.example/reward', text: 'There may be a gift for your account. More information will be available later.', expectedState: 'inconclusive', expectedSeverity: 'caution', explanation: 'This excerpt does not establish who runs the offer or what it will request. There is not enough evidence to verify it or accuse it of fraud.', safeAction: 'Check the offer through an independently known game channel before continuing.' },
  { id: 'P10', variant: 'baseline', title: "Susan's fictional toll email", illustrativeUrl: 'https://toll-notice.example/settle', text: 'Unpaid toll notice. Pay immediately to avoid additional penalties. Fictional email to Susan, 68: Your toll payment is overdue. Pay within two hours to avoid a penalty. Displayed link: City Toll Service. Actual destination: https://toll-notice.example/settle. Enter your card details there.', expectedState: 'concern-found', expectedSeverity: 'high-concern', explanation: 'The fictional email combines a short deadline with a request for card details at toll-notice.example. The displayed service name does not verify that destination. This evidence supports caution; it does not prove whether any toll is owed.', safeAction: 'Do not use the email link. Check your toll account through your usual app, a saved official address, or a number on a previous genuine statement. Ask the provider independently whether a payment is due.' },
  { id: 'P10', variant: 'safe', title: 'A toll safety lesson', illustrativeUrl: 'https://learning.example/tolls', text: 'A lesson quotes an overdue toll email and explains how to check a bill independently. This page asks for no payment or card details.', expectedState: 'no-supported-indicators', expectedSeverity: 'informational', explanation: 'This is educational context, not an actual toll-payment request. A mention of a bill or penalty alone does not establish fraud.', safeAction: 'Read the surrounding context and use an independently known provider address for real bills.' },
  { id: 'P10', variant: 'ambiguous', title: 'An incomplete toll reminder', illustrativeUrl: 'https://notice.example/toll', text: 'Fictional reminder: a toll statement may be ready. The excerpt contains no destination or payment request.', expectedState: 'inconclusive', expectedSeverity: 'caution', explanation: 'The excerpt has too little evidence to establish the sender or whether payment is due. Missing information is not proof of dishonesty.', safeAction: 'Check the account independently before making a payment or sharing details.' },
  { id: 'P16', variant: 'baseline', title: 'A lesson about suspicious messages', illustrativeUrl: 'https://learning.example/credential-guide', text: 'Scam-awareness lesson: a message that says “send your password” is an example to discuss, not a request to enter one here.', expectedState: 'no-supported-indicators', expectedSeverity: 'informational', explanation: 'This synthetic educational page discusses a credential scam. It does not itself request credentials. Words alone are not proof of a threat.', safeAction: 'Read the context and actual request before deciding. Keep your credentials private.' },
  { id: 'P16', variant: 'safe', title: 'Community learning notice', illustrativeUrl: 'https://community.example/lesson', text: 'Our community lesson teaches how to inspect links. No sign-in, payment or personal information is requested.', expectedState: 'no-supported-indicators', expectedSeverity: 'informational', explanation: 'The example requests no account details or payment. This limited observation is not a general verification of the site.', safeAction: 'Use context and independently known sources when an actual request appears.' },
  { id: 'P16', variant: 'ambiguous', title: 'An invitation without enough context', illustrativeUrl: 'https://community.example/invite', text: 'Join a community event. Details about the organizer are not included in this excerpt.', expectedState: 'inconclusive', expectedSeverity: 'caution', explanation: 'Missing organizer details leave uncertainty. An incomplete invitation is not evidence by itself that the organizer is dishonest.', safeAction: 'Find the organizer through an independent source before sharing details.' },
].map(fixture => fixtureSchema.parse({ ...fixture, uncertainty: uncertain }));

export const providerStatuses = [
  ...(['k-ID', 'Gemini', 'Inworld', 'Modulate'] as const).map(provider => providerStatusSchema.parse({ provider, status: 'not configured', mode: null, detail: 'Foundation interface only. No live provider calls or simulated approvals.' })),
  providerStatusSchema.parse({ provider: 'FastSpring', status: 'deferred', mode: null, detail: 'Outside the foundation and core demonstration.' }),
];
export const scenarioCatalog = Array.from({ length: 18 }, (_, index) => ({ id: `P${String(index + 1).padStart(2, '0')}`, status: index === 0 || index === 9 || index === 15 ? 'baseline fixtures available' : 'not implemented' }));

// A deterministic public fixture renderer, not a production identity/session issuer.
export function renderDemo(input: DemoRequest) {
  const request = demoRequestSchema.parse(input);
  const fixture = baselineFixtures.find(f => f.id === request.fixtureId && f.variant === request.variant)!;
  const ownerId = `demo:${request.persona}`;
  const now = new Date().toISOString();
  const prefix = `${fixture.id}:${fixture.variant}`;
  const domain = describeUrl(fixture.illustrativeUrl);
  const evidence = [
    { id: `${prefix}:request`, observation: 'Pre-authored visible fixture text', excerpt: fixture.text },
    { id: `${prefix}:address`, observation: 'Illustrative address metadata, not the actual tab URL', excerpt: `Hostname: ${domain.hostname}; registrable domain: ${domain.registrableDomain ?? 'not established'}` },
    ...(fixture.id === 'P01' && fixture.variant === 'baseline' ? [
      { id: `${prefix}:secrecy`, observation: 'A request for secrecy', excerpt: 'don’t tell your parents' },
      { id: `${prefix}:verification`, observation: 'Payment attached to a supposedly free reward', excerpt: 'buy the verification pack' },
      { id: `${prefix}:link`, observation: 'An invitation to activate an unverified link', excerpt: 'Open this link' },
    ] : []),
  ];
  return demoResponseSchema.parse({
    context: { id: ownerId, mode: 'local-demo', persona: request.persona, contextVersion: 1, jurisdiction: { country: 'US', source: 'synthetic' }, preferences: { largeText: false, plainLanguage: false } },
    capabilities: { ownerId, mode: 'local-demo', contextVersion: 1, decisions: Object.fromEntries(capabilityNames.map(name => [name, { state: 'unknown', provenance: 'not-configured', reason: 'W02 must establish a documented server-owned permission session.', validatedAt: now }])) },
    fixture,
    assessment: {
      id: `${prefix}:${request.persona}`, ownerId, contextVersion: 1, mode: 'local-demo', source: 'fixture', detectorVersion: 'fixture-v1',
      category: fixture.id === 'P01' ? 'credential' : fixture.id === 'P10' ? 'financial' : 'comparison', severity: fixture.expectedSeverity, state: fixture.expectedState, intervention: 'explain',
      evidence, evidenceIds: evidence.map(item => item.id), explanation: fixture.explanation, uncertainty: fixture.uncertainty, safeActions: [fixture.safeAction], createdAt: now,
    },
    challenge: baselineChallenge,
  });
}

// Controlled-fixture recognition only. Match the complete public fixture text
// and destination; a marker or keywords alone cannot establish a finding.
export function recognizeControlledFixture(input: { actualUrl: string; fixtureId: string; variant: string; visibleText: string; destination: string }) {
  if (input.actualUrl.length > 2048 || input.visibleText.length > 10000 || input.destination.length > 2048) return null;
  let url: URL; try { url = new URL(input.actualUrl); } catch { return null; }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== `/fixtures/${input.fixtureId}` || (url.searchParams.get('variant') ?? 'baseline') !== input.variant) return null;
  const fixture = baselineFixtures.find(f => f.id === input.fixtureId && f.variant === input.variant);
  return fixture && fixture.text === input.visibleText.trim() && fixture.illustrativeUrl === input.destination.trim() ? fixture : null;
}
