const ROOT_TAXONOMY = [
  {
    name: "Formal sciences",
    summary:
      "Disciplines centered on abstract structures, symbolic systems, computation, inference, and mathematical modeling.",
  },
  {
    name: "Natural sciences",
    summary:
      "Disciplines focused on the physical universe, life, matter, energy, Earth systems, and observable natural phenomena.",
  },
  {
    name: "Social sciences",
    summary:
      "Disciplines focused on human behavior, institutions, culture, markets, governance, and social systems.",
  },
  {
    name: "Philosophy",
    summary:
      "Disciplines focused on metaphysics, epistemology, logic, ethics, aesthetics, and the critical analysis of knowledge and reality.",
  },
];

const BREADTH_TARGETS = {
  compact: "8 to 12",
  broad: "14 to 22",
  maximal: "20 to 36",
};

const ROLE_VALUES = ["field", "subfield", "specialty", "topic", "concept_family"];
const CONFIDENCE_VALUES = ["high", "medium", "low"];

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }

    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function buildJsonSchema(name, schema) {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema,
  };
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  const parts = [];

  for (const item of data.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

async function callOpenAI({ prompt, schemaName, schema }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: prompt,
      text: {
        format: buildJsonSchema(schemaName, schema),
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "OpenAI API request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = extractResponseText(data);
  if (!text) {
    const error = new Error("OpenAI returned no text output for this structured response.");
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error(`OpenAI returned non-JSON structured output: ${text.slice(0, 240)}`);
    error.statusCode = 502;
    throw error;
  }
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function canonicalizeLabel(value) {
  let label = normalizeName(value)
    .replace(/&/g, " and ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (label.endsWith("ies") && label.length > 4) {
    label = `${label.slice(0, -3)}y`;
  } else if (label.endsWith("s") && !label.endsWith("ss") && label.length > 4) {
    label = label.slice(0, -1);
  }

  return label;
}

function tokenizeLabel(value) {
  return canonicalizeLabel(value)
    .split(" ")
    .filter(Boolean);
}

function toInitialism(value) {
  const tokens = tokenizeLabel(value);
  if (tokens.length < 2) {
    return "";
  }
  return tokens.map((token) => token[0]).join("");
}

function jaccardSimilarity(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const union = new Set([...left, ...right]);
  if (!union.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection / union.size;
}

function looksNearDuplicate(leftLabel, rightLabel) {
  const leftCanonical = canonicalizeLabel(leftLabel);
  const rightCanonical = canonicalizeLabel(rightLabel);

  if (!leftCanonical || !rightCanonical) {
    return false;
  }

  if (leftCanonical === rightCanonical) {
    return true;
  }

  const leftInitialism = toInitialism(leftLabel);
  const rightInitialism = toInitialism(rightLabel);
  if (
    leftInitialism &&
    rightInitialism &&
    (leftInitialism === rightCanonical.replace(/\s+/g, "") ||
      rightInitialism === leftCanonical.replace(/\s+/g, ""))
  ) {
    return true;
  }

  const leftTokens = tokenizeLabel(leftLabel);
  const rightTokens = tokenizeLabel(rightLabel);
  const similarity = jaccardSimilarity(leftTokens, rightTokens);

  if (similarity >= 0.8 && Math.min(leftTokens.length, rightTokens.length) >= 2) {
    return true;
  }

  if (
    Math.min(leftTokens.length, rightTokens.length) >= 3 &&
    (leftCanonical.includes(rightCanonical) || rightCanonical.includes(leftCanonical))
  ) {
    return true;
  }

  return false;
}

function uniqueStrings(values) {
  const results = [];
  const seen = new Set();

  for (const value of values || []) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      continue;
    }

    const key = normalizeName(normalized);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(normalized);
  }

  return results;
}

function makeAliasList(item) {
  return uniqueStrings([item.name, ...(item.aliases || [])]);
}

function hasNearDuplicate(label, collection) {
  return collection.some((candidate) => looksNearDuplicate(label, candidate));
}

function filterNearDuplicateItems(items, existingChildren) {
  const existingLabels = uniqueStrings(existingChildren);
  const acceptedLabels = [...existingLabels];
  const acceptedItems = [];
  const droppedNames = [];

  for (const item of items) {
    const aliases = makeAliasList(item);
    const itemLabels = aliases.length ? aliases : [item.name];
    const duplicate = itemLabels.some((label) => hasNearDuplicate(label, acceptedLabels));

    if (duplicate) {
      droppedNames.push(item.name);
      continue;
    }

    acceptedItems.push({
      ...item,
      aliases: uniqueStrings(item.aliases || []),
      keywords: uniqueStrings(item.keywords || []),
    });
    acceptedLabels.push(...itemLabels);
  }

  return {
    acceptedItems,
    droppedNames,
  };
}

function taxonomyPrompt({
  pathSegments,
  existingChildren,
  breadth,
  customFocus,
  mode,
}) {
  const currentNode = pathSegments.at(-1);
  const pathLabel = pathSegments.join(" > ");

  return [
    "You are building a high-coverage taxonomy of the sciences for an interactive explorer.",
    "Return only DIRECT child categories of the target node.",
    "Do not return grandchildren.",
    "Prefer canonical academic branches, recognized subdisciplines, or recognized specialty areas.",
    "Be conservative. If uncertain, omit the item rather than inventing a dubious discipline.",
    "Avoid duplicate or near-duplicate labels, abbreviations that duplicate full names, and singular/plural variants of the same concept.",
    "Keep all returned children at the same level of abstraction.",
    "Do not mix disciplines with methods, institutions, named theories, or example case studies unless the current node is already narrow enough that those are the correct direct children.",
    "If mode is 'find_more', focus only on plausible missing siblings not already listed.",
    "If an item is interdisciplinary, keep a single canonical label and mention overlap in the summary or caution_note rather than duplicating it under multiple names.",
    "",
    `Target taxonomy path: ${pathLabel}`,
    `Current node: ${currentNode}`,
    `Mode: ${mode}`,
    `Desired breadth: ${breadth} (${BREADTH_TARGETS[breadth] || BREADTH_TARGETS.maximal} children if available)`,
    existingChildren.length
      ? `Already known direct children to avoid duplicating: ${existingChildren.join("; ")}`
      : "Already known direct children to avoid duplicating: none",
    customFocus ? `Additional user focus: ${customFocus}` : "Additional user focus: none",
    "",
    "For each child item:",
    "- name: concise canonical label",
    "- aliases: zero to three alternative names or abbreviations if useful",
    "- summary: one sentence describing the child",
    "- why_it_belongs: why it is a direct child of the target node",
    "- keywords: three to six search keywords",
    "- likely_has_children: whether the item can be expanded further",
    "- child_scope_label: short phrase like 'subfields', 'branches', 'specialties', or 'concept families'",
    "- taxonomy_role: one of field, subfield, specialty, topic, concept_family",
    "- confidence: high, medium, or low",
    "- caution_note: leave empty unless there is a real ambiguity or overlap worth flagging",
    "",
    "If there are more valid children beyond the list, explain that briefly in remaining_note.",
  ].join("\n");
}

function bibliographyPrompt({ pathSegments, summary, keywords }) {
  const target = pathSegments.join(" > ");
  const keywordLine = Array.isArray(keywords) && keywords.length ? keywords.join(", ") : "none provided";

  return [
    "Generate a categorized bibliography for the requested knowledge-taxonomy item.",
    "Be conservative and avoid invented details.",
    "Prefer classic primary sources, field-defining books, major surveys, breakthrough papers, and strong teaching texts.",
    "If exact details are uncertain, either omit the item or state the uncertainty in the note rather than fabricating.",
    "Return references specific to the target item, not generic references to the entire parent discipline unless they are truly foundational for the target.",
    "Use the categories seminals works, breakthrough works, pedagogy texts, reference works, and recent syntheses.",
    "Pedagogy texts should help a serious newcomer learn the area rather than only document frontier research.",
    "",
    `Target item: ${target}`,
    `Summary: ${summary || "No summary supplied."}`,
    `Keywords: ${keywordLine}`,
    "",
    "Organize the bibliography into categories.",
    "Any category may be empty if there are no safe recommendations.",
  ].join("\n");
}

function conceptTreePrompt({ pathSegments, summary, keywords }) {
  const target = pathSegments.join(" > ");
  const keywordLine = Array.isArray(keywords) && keywords.length ? keywords.join(", ") : "none provided";

  return [
    "Generate a core-concept map and learning roadmap for the requested science or philosophy topic.",
    "Be conservative and pedagogically structured.",
    "Organize concepts from beginner to advanced.",
    "Prefer real prerequisite structure instead of random lists.",
    "If uncertain, keep the scope tighter rather than inventing fringe topics.",
    "Focus on core concepts a serious learner should know, not on named schools, temporary fashions, or loose neighboring topics.",
    "",
    `Target item: ${target}`,
    `Summary: ${summary || "No summary supplied."}`,
    `Keywords: ${keywordLine}`,
    "",
    "Return prerequisites, beginner concepts, intermediate concepts, advanced concepts, milestone capabilities, and a bibliography grouped as pedagogy texts, seminal works, breakthrough works, and advanced syntheses.",
  ].join("\n");
}

function taxonomySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      remaining_note: { type: "string" },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            aliases: {
              type: "array",
              minItems: 0,
              maxItems: 3,
              items: { type: "string" },
            },
            summary: { type: "string" },
            why_it_belongs: { type: "string" },
            keywords: {
              type: "array",
              minItems: 3,
              maxItems: 6,
              items: { type: "string" },
            },
            likely_has_children: { type: "boolean" },
            child_scope_label: { type: "string" },
            taxonomy_role: {
              type: "string",
              enum: ROLE_VALUES,
            },
            confidence: {
              type: "string",
              enum: CONFIDENCE_VALUES,
            },
            caution_note: { type: "string" },
          },
          required: [
            "name",
            "aliases",
            "summary",
            "why_it_belongs",
            "keywords",
            "likely_has_children",
            "child_scope_label",
            "taxonomy_role",
            "confidence",
            "caution_note",
          ],
        },
      },
    },
    required: ["overview", "remaining_note", "items"],
  };
}

function bibliographyItemSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      authors: { type: "string" },
      title: { type: "string" },
      year: { type: "string" },
      source: { type: "string" },
      why_it_matters: { type: "string" },
      confidence: {
        type: "string",
        enum: CONFIDENCE_VALUES,
      },
    },
    required: ["authors", "title", "year", "source", "why_it_matters", "confidence"],
  };
}

function bibliographyCategorySchema() {
  return {
    type: "array",
    minItems: 0,
    maxItems: 5,
    items: bibliographyItemSchema(),
  };
}

function bibliographySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      note: { type: "string" },
      caution_note: { type: "string" },
      categories: {
        type: "object",
        additionalProperties: false,
        properties: {
          seminal_works: bibliographyCategorySchema(),
          breakthrough_works: bibliographyCategorySchema(),
          pedagogy_texts: bibliographyCategorySchema(),
          reference_works: bibliographyCategorySchema(),
          recent_syntheses: bibliographyCategorySchema(),
        },
        required: [
          "seminal_works",
          "breakthrough_works",
          "pedagogy_texts",
          "reference_works",
          "recent_syntheses",
        ],
      },
    },
    required: ["note", "caution_note", "categories"],
  };
}

function conceptItemSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      summary: { type: "string" },
    },
    required: ["name", "summary"],
  };
}

function conceptStageSchema(maxItems) {
  return {
    type: "array",
    minItems: 2,
    maxItems,
    items: conceptItemSchema(),
  };
}

function conceptsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      note: { type: "string" },
      caution_note: { type: "string" },
      prerequisites: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: { type: "string" },
      },
      learning_stages: {
        type: "object",
        additionalProperties: false,
        properties: {
          beginner: conceptStageSchema(8),
          intermediate: conceptStageSchema(8),
          advanced: conceptStageSchema(8),
        },
        required: ["beginner", "intermediate", "advanced"],
      },
      milestone_capabilities: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { type: "string" },
      },
      bibliography_by_level: {
        type: "object",
        additionalProperties: false,
        properties: {
          pedagogy_texts: bibliographyCategorySchema(),
          seminal_works: bibliographyCategorySchema(),
          breakthrough_works: bibliographyCategorySchema(),
          advanced_syntheses: bibliographyCategorySchema(),
        },
        required: ["pedagogy_texts", "seminal_works", "breakthrough_works", "advanced_syntheses"],
      },
    },
    required: [
      "note",
      "caution_note",
      "prerequisites",
      "learning_stages",
      "milestone_capabilities",
      "bibliography_by_level",
    ],
  };
}

async function handleTaxonomyRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    const pathSegments = Array.isArray(body.path)
      ? body.path.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const existingChildren = Array.isArray(body.existingChildren)
      ? body.existingChildren.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const breadth = ["compact", "broad", "maximal"].includes(body.breadth) ? body.breadth : "maximal";
    const customFocus = typeof body.customFocus === "string" ? body.customFocus.trim() : "";
    const mode = body.mode === "find_more" ? "find_more" : "initial";

    if (pathSegments.length === 0) {
      sendJson(res, 200, {
        path: [],
        overview: "Top-level knowledge domains ready for expansion.",
        remaining_note:
          "This root split is fixed in the app. Expand each branch to generate a deeper taxonomy.",
        dropped_duplicates: [],
        items: ROOT_TAXONOMY.map((item) => ({
          ...item,
          aliases: [],
          why_it_belongs: "This is one of the app's top-level knowledge domains.",
          keywords: item.name.split(" "),
          likely_has_children: true,
          child_scope_label: "branches",
          taxonomy_role: "field",
          confidence: "high",
          caution_note: "",
        })),
      });
      return;
    }

    const payload = await callOpenAI({
      prompt: taxonomyPrompt({
        pathSegments,
        existingChildren,
        breadth,
        customFocus,
        mode,
      }),
      schemaName: "science_taxonomy_children",
      schema: taxonomySchema(),
    });

    const { acceptedItems, droppedNames } = filterNearDuplicateItems(payload.items, existingChildren);

    sendJson(res, 200, {
      path: pathSegments,
      overview: payload.overview,
      remaining_note: payload.remaining_note,
      dropped_duplicates: droppedNames,
      items: acceptedItems,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Unexpected server error.",
    });
  }
}

async function handleBibliographyRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    const pathSegments = Array.isArray(body.path)
      ? body.path.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!pathSegments.length) {
      sendJson(res, 400, { error: "Bibliography requests require a non-empty taxonomy path." });
      return;
    }

    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(String) : [];

    const payload = await callOpenAI({
      prompt: bibliographyPrompt({ pathSegments, summary, keywords }),
      schemaName: "categorized_seminal_bibliography",
      schema: bibliographySchema(),
    });

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Unexpected server error.",
    });
  }
}

async function handleConceptTreeRequest(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    const pathSegments = Array.isArray(body.path)
      ? body.path.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!pathSegments.length) {
      sendJson(res, 400, { error: "Concept-tree requests require a non-empty taxonomy path." });
      return;
    }

    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(String) : [];

    const payload = await callOpenAI({
      prompt: conceptTreePrompt({ pathSegments, summary, keywords }),
      schemaName: "concept_tree_learning_map",
      schema: conceptsSchema(),
    });

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Unexpected server error.",
    });
  }
}

function handleHealthRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
  });
}

module.exports = {
  handleBibliographyRequest,
  handleConceptTreeRequest,
  handleHealthRequest,
  handleTaxonomyRequest,
};
