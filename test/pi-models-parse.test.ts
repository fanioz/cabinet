import test from "node:test";
import assert from "node:assert/strict";
import { parsePiModels } from "../src/lib/agents/providers/pi";

test("parses one model id per line with thinking effort levels", () => {
  const models = parsePiModels(
    ["xai/grok-4.3", "anthropic/claude-opus-4-7", "openai/gpt-5.4"].join("\n")
  );
  assert.deepEqual(
    models.map((m) => m.id),
    ["xai/grok-4.3", "anthropic/claude-opus-4-7", "openai/gpt-5.4"]
  );
  assert.equal(models[0].name, "xai/grok-4.3");
  assert.ok((models[0].effortLevels || []).some((e) => e.id === "xhigh"));
});

test("drops blank lines and # comment/banner lines", () => {
  const models = parsePiModels(
    ["# Available models", "", "xai/grok-4.3", "  ", "# end"].join("\n")
  );
  assert.deepEqual(
    models.map((m) => m.id),
    ["xai/grok-4.3"]
  );
});

test("output that is ONLY a banner falls back instead of going blank", () => {
  const models = parsePiModels("# No models configured — set XAI_API_KEY\n");
  assert.ok(models.length > 0);
  assert.ok(models.some((m) => m.id === "anthropic/claude-opus-4-7"));
});

test("empty / nullish output falls back to the offline list", () => {
  for (const input of ["", "   \n ", null, undefined]) {
    const models = parsePiModels(input);
    assert.ok(models.length > 0, "fallback must not be empty");
    assert.ok(models.some((m) => m.id === "xai/grok-4.3"));
  }
});

test("parses table format with provider/model identifiers", () => {
  const input = [
    "provider     model            context   max-out    thinking  images",
    "tfm          glm/glm-5.2     128K      16.4K      no        no",
    "openai       gpt-4           8.2K      8.2K       no        no",
  ].join("\n");

  const models = parsePiModels(input);
  assert.deepEqual(
    models.map((m) => m.id),
    ["glm/glm-5.2", "openai/gpt-4"]
  );
  assert.equal(models[0].name, "glm/glm-5.2");
  assert.ok((models[0].effortLevels || []).some((e) => e.id === "high"));
});

test("parses table format and combines provider when model lacks slash", () => {
  const input = [
    "provider  model     context  max-out  thinking  images",
    "xai       grok-4.3  128K     16.4K    no        no",
  ].join("\n");

  const models = parsePiModels(input);
  assert.deepEqual(models.map((m) => m.id), ["xai/grok-4.3"]);
});

test("parses multiple table rows and combines provider when model lacks slash", () => {
  const input = [
    "provider  model     context  max-out  thinking  images",
    "tfm       grok-4.3  128K     16.4K    no        no",
    "openai    gpt-4     8.2K     8.2K     no        no",
  ].join("\n");

  const models = parsePiModels(input);
  assert.deepEqual(models.map((m) => m.id), ["tfm/grok-4.3", "openai/gpt-4"]);
});

test("table with only header falls back to offline list", () => {
  const models = parsePiModels(
    "provider  model  context  max-out  thinking  images\n"
  );
  assert.ok(models.length > 0);
  assert.ok(models.some((m) => m.id === "google/gemini-3.1-pro"));
});
