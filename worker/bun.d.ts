declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: {
    (value: unknown): {
      toBe(expected: unknown): void;
      toContain(expected: unknown): void;
      toEqual(expected: unknown): void;
      toMatchObject(expected: unknown): void;
      toThrow(): void;
      not: { toContain(expected: unknown): void };
    };
  };
}

interface ImportMeta {
  main?: boolean;
}

declare const Bun: {
  file(path: string): Blob;
};
