import type { Api } from '../preload';
declare global { interface Window { lw: Api } }
export {};

declare global { const __LW_VERSION__: string; }
