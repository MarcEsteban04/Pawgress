/**
 * Provider chain tests for `src/lib/ai/chat.ts`.
 *
 *   npm run ai:test
 *
 * Makes real calls to Groq, Gemini and OpenAI with the keys in .env.local,
 * using the same SDK calls the service makes, and checks that the fallback
 * behaves: first provider wins, a retired model falls through, two dead
 * providers reach OpenAI, and a timeout counts as unavailable.
 *
 * Why real calls: the thing most likely to break here is not our logic but a
 * provider retiring a model or changing what it accepts. Groq did exactly that
 * to llama-3.3-70b-versatile. A mocked test would have passed.
 *
 * It costs a few tenths of a cent per run and never prints a key.
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI, { APIError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const PROVIDERS = [
  {
    id: "groq",
    key: process.env.GROQ_AI_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    timeoutMs: 30_000,
  },
  {
    id: "gemini",
    key: process.env.GEMINI_AI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.5-flash",
    timeoutMs: 45_000,
  },
  {
    id: "openai",
    key: process.env.OPENAI_API_KEY,
    baseURL: undefined,
    model: "gpt-4o-mini",
    timeoutMs: 90_000,
  },
];

const Schema = z.object({
  title: z.string(),
  points: z.array(z.string()),
});

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
};

function isProviderUnavailable(thrown) {
  if (thrown instanceof APIError) {
    const s = thrown.status;
    if (s === undefined) return true;
    if (s === 401 || s === 403 || s === 404 || s === 408 || s === 429) return true;
    return s >= 500;
  }
  return true;
}

async function callOne(provider) {
  const client = new OpenAI({
    apiKey: provider.key,
    baseURL: provider.baseURL,
    timeout: provider.timeoutMs,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.parse({
    model: provider.model,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: "You are a study assistant. Answer only from the material given.",
      },
      {
        role: "user",
        content:
          "<<<STUDENT_MATERIAL>>>\nMitochondria produce ATP through oxidative phosphorylation.\n<<<END>>>\n\nSummarise this. Give a title and two points.",
      },
    ],
    response_format: zodResponseFormat(Schema, "result"),
  });

  return {
    parsed: completion.choices[0]?.message.parsed,
    usage: completion.usage,
  };
}

/** The chain, exactly as chat.ts runs it. */
async function generate(chain) {
  const tried = [];
  let lastError = null;

  for (const provider of chain) {
    try {
      const result = await callOne(provider);
      return { provider: provider.id, tried, ...result };
    } catch (thrown) {
      tried.push(`${provider.id}:${thrown.status ?? thrown.name}`);
      if (isProviderUnavailable(thrown)) {
        lastError = thrown;
        continue;
      }
      throw thrown;
    }
  }
  throw lastError ?? new Error("no providers");
}

console.log("\n1. Normal chain — should stop at the first provider\n");
{
  const started = Date.now();
  const result = await generate(PROVIDERS);
  check("answered", Boolean(result.parsed), JSON.stringify(result.parsed).slice(0, 80));
  check("used groq (first in the chain)", result.provider === "groq", result.provider);
  check("output matches the schema", Schema.safeParse(result.parsed).success);
  check("usage reported", (result.usage?.prompt_tokens ?? 0) > 0, JSON.stringify(result.usage));
  console.log(`        ${Date.now() - started}ms · ${JSON.stringify(result.parsed).slice(0, 110)}`);
}

console.log("\n2. Groq broken (retired model) — should fall through to Gemini\n");
{
  const chain = [{ ...PROVIDERS[0], model: "llama-3.3-70b-versatile" }, ...PROVIDERS.slice(1)];
  const result = await generate(chain);
  check("fell through to gemini", result.provider === "gemini", result.provider);
  check(
    "groq recorded as tried with a 404",
    result.tried.join(",").includes("groq:404"),
    result.tried.join(","),
  );
  check("output still matches the schema", Schema.safeParse(result.parsed).success);
}

console.log("\n3. Groq and Gemini both broken — should reach OpenAI last\n");
{
  const chain = [
    { ...PROVIDERS[0], model: "does-not-exist" },
    { ...PROVIDERS[1], model: "does-not-exist" },
    PROVIDERS[2],
  ];
  const result = await generate(chain);
  check("reached openai", result.provider === "openai", result.provider);
  check("both earlier providers were tried", result.tried.length === 2, result.tried.join(","));
  check("output still matches the schema", Schema.safeParse(result.parsed).success);
}

console.log("\n4. A timeout counts as unavailable\n");
{
  const chain = [{ ...PROVIDERS[0], timeoutMs: 1 }, ...PROVIDERS.slice(1)];
  const result = await generate(chain);
  check("a 1ms timeout falls through", result.provider !== "groq", result.provider);
  check("timeout classified as unavailable", result.tried.length >= 1, result.tried.join(","));
}

console.log(failures === 0 ? "\nall passed\n" : `\n${failures} failed\n`);
process.exitCode = failures === 0 ? 0 : 1;
