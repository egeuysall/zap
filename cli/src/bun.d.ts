declare const Bun: {
  argv: string[];
  file(path: string): Blob;
  spawn(command: string[], options: { stdout: "pipe"; stderr: "pipe" }): {
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
    exited: Promise<number>;
  };
};

interface ImportMeta {
  main?: boolean;
}
