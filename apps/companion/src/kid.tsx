import React, { lazy, Suspense, useState, type ReactNode } from 'react';

const Widget = lazy(() => import('ozone:kid-widget').then(module => ({ default: module.KidRoot })));

// Offline teaching is independent of the unverified vendor-widget workflow.
// Enabling this build option never authorizes a protected backend operation.
export function KidRoot({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return <>
    <aside className="widget-status" aria-label="k-ID integration status">
      <p>Browser-widget claim redemption is unverified. Offline fixture practice remains available; the separate server-owned CDK test checks its own permissions.</p>
      {__KID_WIDGET_ENABLED__ ? <>
        <p>The optional test widget can contact k-ID and declare product settings. Its result does not authorize this application.</p>
        <button onClick={() => setOpened(!opened)}>{opened ? 'Return to offline demo' : 'Open k-ID test widget'}</button>
      </> : <p>Vendor widget unavailable in this build; no SDK or credentials are needed for the offline demo.</p>}
    </aside>
    {opened && __KID_WIDGET_ENABLED__ ? <Suspense fallback={<p role="status">Loading the optional k-ID widget…</p>}><Widget>{children}</Widget></Suspense> : children}
  </>;
}
