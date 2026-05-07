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

function coverageItem() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      level: { type: "integer", enum: [2, 3, 4] },
      parent_path: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "string" },
      },
      foundational_work: { type: "string" },
      why_missing: { type: "string" },
      confidence: { type: "string", enum: CONFIDENCE_VALUES },
    },
    required: ["name", "level", "parent_path", "foundational_work", "why_missing", "confidence"],
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
        maxItems: mode === "coverage" ? 60 : 24,
        items: mode === "bibliography" ? bibliographyItem() : mode === "coverage" ? coverageItem() : schemaItem(),
      },
    },
    required: ["overview", "items"],
  };
}

function explanationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      plain_language: { type: "string" },
      analogy: { type: "string" },
      examples: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: { type: "string" },
      },
      why_it_matters: { type: "string" },
      key_terms: {
        type: "array",
        minItems: 4,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            term: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["term", "explanation"],
        },
      },
      common_misconception: { type: "string" },
      how_to_learn_next: { type: "string" },
    },
    required: [
      "title",
      "plain_language",
      "analogy",
      "examples",
      "why_it_matters",
      "key_terms",
      "common_misconception",
      "how_to_learn_next",
    ],
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
    const error = new Error("Add an OpenAI API key or configure OPENAI_API_KEY to use this feature.");
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
  if (!text) throw new Error("OpenAI returned no output.");
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

function coveragePrompt(body) {
  const selectedPath = (body.selectedPath || []).join(" > ");
  const subtree = JSON.stringify(body.subtree || []).slice(0, 65000);

  return [
    "Deep-audit a user-supplied theoretical sciences taxonomy for missing L2-L4 coverage.",
    "Return only established, well-documented academic subdomains, subfields, theories, models, or concepts.",
    "Do not invent plausible-sounding categories. Do not return fashionable buzzwords, courses, departments, tools, websites, or administrative labels.",
    "Do not duplicate existing names, aliases, near-synonyms, singular/plural variants, or items already present in the subtree.",
    "Every returned item must be a direct child of an existing parent_path from the supplied subtree.",
    "Do not use a missing proposed item as the parent of another proposed item. Parent paths must already exist in the subtree.",
    "Use level 2 only for major direct subdomains under an L1 domain, level 3 for subfields under L2, and level 4 for specific theories/models/concepts under L3.",
    "Prioritise omissions that a rigorous university curriculum, handbook, encyclopedia, or standard field taxonomy would consider core.",
    "For L4 items, include a concise foundational_work string when a canonical work or origin is well known; otherwise use a short field-defining note.",
    "If the supplied branch is already adequately covered at this pass, return an empty items array.",
    "",
    `Selected branch: ${selectedPath}`,
    `Existing subtree JSON: ${subtree}`,
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

function explanationPrompt(body) {
  const selectedPath = (body.selectedPath || []).join(" > ");
  const childNames = (body.childNames || []).slice(0, 80).join("; ") || "none";
  const bibliography = JSON.stringify(body.bibliography || []).slice(0, 10000);

  return [
    "Explain one selected item from a user-supplied theoretical-sciences taxonomy.",
    "Use the selected path as the exact context. Do not wander into unrelated fields.",
    "Teach like a patient school teacher explaining to a curious 12- to 15-year-old student.",
    "Move one level at a time: first say what the parent field is, then what this item studies, then why it exists, then how examples work.",
    "Use short paragraphs, simple vocabulary, and everyday analogies before any formal wording.",
    "If you must use a technical word, immediately explain it in plain school-level language.",
    "Avoid university-level shortcuts, dense abstractions, unexplained jargon, and long lists of named theorems.",
    "Make the plain_language field a step-by-step mini lesson, not a compact encyclopedia paragraph.",
    "Make the analogy vivid and ordinary, such as school timetables, maps, recipes, games, building blocks, traffic, or sorting objects.",
    "Make the examples concrete and easy to imagine. Each example should teach one small idea.",
    "Include why the item matters, key terms, one common misconception, and what to learn next.",
    "Do not invent fake citations. If bibliography is present, use it only as context.",
    "Avoid generic filler. Make the explanation specific to the selected item.",
    "",
    `Selected path: ${selectedPath}`,
    `Level: L${body.level || ""}`,
    `Notes/cross-references/foundational text: ${body.note || "none"}`,
    `Direct child items: ${childNames}`,
    `Bibliography additions: ${bibliography}`,
  ].join("\n");
}

async function handleAuditRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    const mode = body.mode === "bibliography" ? "bibliography" : body.mode === "coverage" ? "coverage" : "taxonomy";
    const payload = await callOpenAI({
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
      prompt: mode === "bibliography" ? bibliographyPrompt(body) : mode === "coverage" ? coveragePrompt(body) : taxonomyPrompt(body),
      schemaName: mode === "bibliography" ? "bibliography_gap_audit" : mode === "coverage" ? "taxonomy_coverage_audit" : "taxonomy_gap_audit",
      schema: auditSchema(mode),
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 502, { error: error.message || "Audit failed." });
  }
}

async function handleExplainRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    if (!Array.isArray(body.selectedPath) || !body.selectedPath.length) {
      sendJson(res, 400, { error: "Select a taxonomy item before requesting an explanation." });
      return;
    }

    const payload = await callOpenAI({
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
      prompt: explanationPrompt(body),
      schemaName: "taxonomy_item_explanation",
      schema: explanationSchema(),
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 502, { error: error.message || "Explanation failed." });
  }
}

module.exports = { handleAuditRequest, handleExplainRequest };
