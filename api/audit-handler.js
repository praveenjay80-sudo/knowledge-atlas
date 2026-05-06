const CONFIDENCE_VALUES = ["high", "medium"];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function schemaItem() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      foundational_work: { type: "string" },
      why_missing: { type: "string" },
      confidence: { type: "string", enum: CONFIDENCE_VALUES },
    },
    required: ["name", "foundational_work", "why_missing", "confidence"],
  };
}

function bibliographyItem() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      authors: { type: "string" },
      title: { type: "string" },
      year: { type: "string" },
      category: { type: "string" },
      why_missing: { type: "string" },
      confidence: { type: "string", enum: CONFIDENCE_VALUES },
    },
    required: ["authors", "title", "year", "category", "why_missing", "confidence"],
  };
}

function auditSchema(mode) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      items: {
        type: "array",
        minItems: 0,
        maxItems: 24,
        items: mode === "bibliography" ? bibliographyItem() : schemaItem(),
      },
    },
    required: ["overview", "items"],
  };
}

function responseFormat(name, schema) {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema,
  };
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAI({ apiKey, prompt, schemaName, schema }) {
  const resolvedKey = apiKey || process.env.OPENAI_API_KEY;
  if (!resolvedKey) {
    const error = new Error("Add an OpenAI API key or configure OPENAI_API_KEY to run audits.");
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedKey}`,
    },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: prompt,
      max_output_tokens: 5000,
      reasoning: { effort: "low" },
      text: { format: responseFormat(schemaName, schema) },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "OpenAI API request failed.");
    error.statusCode = response.status;
    throw error;
  }

  const text = extractResponseText(data);
  if (!text) throw new Error("OpenAI returned no audit output.");
  return JSON.parse(text);
}

function taxonomyPrompt(body) {
  const selectedPath = (body.selectedPath || []).join(" > ");
  const auditParentPath = (body.auditParentPath || []).join(" > ");
  const existing = (body.existingNames || []).join("; ") || "none";
  const level = Number(body.auditLevel || 4);

  return [
    "Audit a user-supplied taxonomy of human knowledge.",
    "Return only core missing taxonomy items. Do not rewrite the taxonomy and do not return old placeholder content.",
    "Use established academic field names, subdisciplines, specialties, or canonical topic names only.",
    "Do not duplicate existing names, aliases, spelling variants, singular/plural variants, or near-synonyms.",
    "Do not add trendy buzzwords, administrative units, departments, courses, websites, or generic buckets.",
    "For Level 4 items, include a concise foundational_work string in the same style as the source text.",
    "If there are no high-confidence omissions, return an empty items array.",
    "",
    `Selected path: ${selectedPath}`,
    `Audit parent path: ${auditParentPath}`,
    `Return missing direct Level ${level} children of the audit parent.`,
    `Existing direct children: ${existing}`,
  ].join("\n");
}

function bibliographyPrompt(body) {
  const selectedPath = (body.selectedPath || []).join(" > ");
  const existing = JSON.stringify(body.existingBibliography || []).slice(0, 12000);

  return [
    "Audit bibliography gaps for one selected taxonomy item.",
    "Return only missing core works that should be linked to this selected field.",
    "Prefer foundational primary works, field-defining monographs, standard textbooks, landmark papers, reference works, and major modern syntheses.",
    "Do not duplicate existing foundational works or bibliography additions.",
    "Do not fabricate uncertain citations. If exact title/authors/year are not known, omit the work.",
    "Use categories such as foundational, textbook, reference, breakthrough, synthesis, or recent survey.",
    "",
    `Selected path: ${selectedPath}`,
    `Selected foundational work text: ${body.foundational || "none"}`,
    `Existing bibliography additions: ${existing}`,
  ].join("\n");
}

async function handleAuditRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    const mode = body.mode === "bibliography" ? "bibliography" : "taxonomy";
    const payload = await callOpenAI({
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
      prompt: mode === "bibliography" ? bibliographyPrompt(body) : taxonomyPrompt(body),
      schemaName: mode === "bibliography" ? "bibliography_gap_audit" : "taxonomy_gap_audit",
      schema: auditSchema(mode),
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 502, { error: error.message || "Audit failed." });
  }
}

module.exports = { handleAuditRequest };
