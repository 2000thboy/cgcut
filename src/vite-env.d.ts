/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZHIPU_API_KEY: string;
  readonly VITE_ZHIPU_MODEL: string;
  readonly VITE_NVIDIA_API_KEY: string;
  readonly VITE_NVIDIA_MODEL: string;
  readonly VITE_CLIP_SERVICE_URL: string;
  readonly VITE_VLM_SERVICE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
