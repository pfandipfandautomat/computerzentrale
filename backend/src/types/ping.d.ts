declare module 'ping' {
  interface PingConfig {
    timeout?: number;
    extra?: string[];
  }

  interface PingResponse {
    alive: boolean;
    time: number | 'unknown';
    host: string;
    output: string;
  }

  const promise: {
    probe: (host: string, config?: PingConfig) => Promise<PingResponse>;
  };

  export { promise, PingConfig, PingResponse };
}
