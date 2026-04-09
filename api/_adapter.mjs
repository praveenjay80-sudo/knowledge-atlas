function buildRequestBody(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

export async function runLegacyHandler(request, legacyHandler) {
  const headers = new Headers();
  let body = undefined;

  if (request.method !== "GET" && request.method !== "HEAD") {
    body = buildRequestBody(await request.text());
  }

  const req = {
    method: request.method,
    body,
  };

  let responseBody = "";
  let statusCode = 200;

  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name, value);
    },
    end(value = "") {
      statusCode = this.statusCode || 200;
      responseBody = typeof value === "string" ? value : String(value ?? "");
    },
  };

  await legacyHandler(req, res);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(responseBody, {
    status: statusCode,
    headers,
  });
}
