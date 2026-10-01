import { getSettings, isConfigured } from "./settings.js";

const DEFAULT_TIMEOUT_MS = 60000;

export function resolveEndpoint(baseUrl) {
  const raw = typeof baseUrl === "string" ? baseUrl.trim() : "";
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed === "") {
    return "";
  }
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed + "/chat/completions";
}

function responseSnippet(text) {
  const value = typeof text === "string" ? text : "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 300) {
    return compact;
  }
  return compact.slice(0, 300) + "…";
}

function abortError() {
  return new Error("AI 请求已取消");
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function requestCompletion(messages, opts, onDelta) {
  const settings = { ...getSettings(), ...(opts.settings || {}) };
  const streaming = typeof onDelta === "function";

  if (!isConfigured(settings)) {
    throw new Error("AI 未配置：请先在设置中填写 baseUrl 与 model");
  }

  const endpoint = resolveEndpoint(settings.baseUrl);
  if (!endpoint) {
    throw new Error("AI 端点无效：baseUrl 为空");
  }
  if (typeof fetch !== "function") {
    throw new Error("当前环境不支持 fetch，无法调用 AI 端点");
  }

  const controller = new AbortController();
  let timer = null;
  if (opts.signal) {
    if (opts.signal.aborted) {
      throw abortError();
    }
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  if (opts.timeoutMs !== 0) {
    const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  const body = {
    model: settings.model,
    messages: Array.isArray(messages) ? messages : [],
    temperature: typeof settings.temperature === "number" ? settings.temperature : 0.7,
    max_tokens: typeof settings.maxTokens === "number" ? settings.maxTokens : 2048
  };
  if (streaming) {
    body.stream = true;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (settings.apiKey || "")
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (err && err.name === "AbortError") {
      throw abortError();
    }
    throw new Error("AI 请求失败：" + (err && err.message ? err.message : String(err)));
  }

  if (!response.ok) {
    const snippet = responseSnippet(await readErrorBody(response));
    if (timer !== null) {
      clearTimeout(timer);
    }
    throw new Error(
      "AI 请求失败（HTTP " + response.status + " " + response.statusText + "）：" + (snippet || "无响应内容")
    );
  }

  let content;
  try {
    if (streaming) {
      content = await consumeStream(response, onDelta);
    } else {
      const data = await response.json();
      content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : undefined;
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw abortError();
    }
    throw new Error("AI 响应解析失败：" + (err && err.message ? err.message : String(err)));
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }

  if (typeof content !== "string") {
    throw new Error("AI 响应缺少 choices[0].message.content 字段");
  }
  return content;
}

async function consumeStream(response, onDelta) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const data = await response.json();
    const fallback = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    if (typeof fallback === "string" && fallback) {
      onDelta(fallback);
    }
    return typeof fallback === "string" ? fallback : "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (payload === "" || payload === "[DONE]") {
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta
        ? parsed.choices[0].delta.content
        : undefined;
      if (typeof delta === "string" && delta !== "") {
        full += delta;
        onDelta(delta);
      }
    }
  }
  return full;
}

export function chat(messages, opts = {}) {
  return requestCompletion(messages, opts, null);
}

export function streamChat(messages, opts = {}, onDelta) {
  return requestCompletion(messages, opts, onDelta);
}

export async function testConnection(opts = {}) {
  const settings = { ...getSettings(), ...(opts.settings || {}), maxTokens: 8 };
  try {
    await chat([{ role: "user", content: "ping" }], { ...opts, settings });
    return { ok: true, messageZh: "连接成功：AI 端点可正常响应" };
  } catch (err) {
    return { ok: false, messageZh: err && err.message ? err.message : "连接失败：未知错误" };
  }
}
