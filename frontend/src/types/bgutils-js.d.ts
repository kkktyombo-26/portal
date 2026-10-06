declare module 'bgutils-js' {
  interface BGConfig {
    fetch: (url: RequestInfo, opts?: RequestInit) => Promise<Response>;
    globalObj: typeof globalThis;
    identifier: string;
    requestKey: string;
  }

  interface BGInstance {
    generatePoToken(identifier: string): Promise<string | null>;
  }

  export const BG: {
    create(config: BGConfig): Promise<BGInstance>;
  };
}