declare const Deno: {
  env: { toObject(): Record<string, string> };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
