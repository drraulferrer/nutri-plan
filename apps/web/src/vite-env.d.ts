/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BOT_USERNAME?: string;
}

/** Hash corto del commit, inyectado en el build (cabecera X-Client-Version). */
declare const __APP_VERSION__: string;
