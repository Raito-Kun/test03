/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIP_WSS_URL?: string;
  readonly VITE_SIP_DOMAIN?: string;
  readonly VITE_SIP_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
