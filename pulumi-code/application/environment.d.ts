declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APIGATEWAY_URL: string;
    }
  }
}

export {};