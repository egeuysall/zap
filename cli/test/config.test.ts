import { expect, test } from "bun:test";
import { resolveEndpoint } from "../src/config";

test("local login endpoint comes from the environment", () => {
  const previous = process.env.ZAP_ENDPOINT;
  process.env.ZAP_ENDPOINT = "http://localhost:3000";
  try {
    expect(resolveEndpoint({ endpoint: "https://zap.egeuysal.com" })).toBe(
      "http://localhost:3000",
    );
  } finally {
    if (previous === undefined) delete process.env.ZAP_ENDPOINT;
    else process.env.ZAP_ENDPOINT = previous;
  }
});
