/// <reference types="vite/client" />

// Browser-visible settings. Only VITE_-prefixed values from the root .env reach the browser.
interface ImportMetaEnv {
  readonly VITE_KID_PUBLISHABLE_KEY?: string;
  readonly VITE_KID_BASE_URL?: string;
  readonly VITE_KID_SUPPORT_EMAIL?: string;
}
