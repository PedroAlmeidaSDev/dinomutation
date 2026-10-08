/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" turns on accounts and the cloud save (needs the API, see the README). */
  readonly VITE_API_ENABLED?: string;
  /** OAuth client id (type "Web") from the Google Cloud Console. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
