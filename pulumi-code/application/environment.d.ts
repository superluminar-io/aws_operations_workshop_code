declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_GATEWAY_URL: string;
    }
  }
}

export {};