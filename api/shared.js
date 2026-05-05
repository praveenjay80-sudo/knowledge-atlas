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

const ROOT_CHILDREN = {
  "Formal sciences": [
    {
      name: "Mathematics",
      aliases: [],
      summary: "The study of abstract structures, quantity, space, change, proof, and formal patterns.",
      why_it_belongs: "Mathematics is the central formal science and supplies the language, methods, and structures used across the rest of the formal domain.",
      keywords: ["proof", "structure", "quantity", "space", "abstraction"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Logic",
      aliases: ["formal logic", "symbolic logic"],
      summary: "The study of valid inference, formal languages, proof systems, and semantic consequence.",
      why_it_belongs: "Logic is a core formal science because it studies inference, formal representation, and the structure of reasoning itself.",
      keywords: ["inference", "proof theory", "semantics", "syntax", "reasoning"],
      likely_has_children: true,
      child_scope_label: "branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Statistics",
      aliases: ["statistical science"],
      summary: "The formal study of uncertainty, variation, inference from data, and probabilistic modeling.",
      why_it_belongs: "Statistics belongs here as a formal discipline built around inference, uncertainty, and model-based reasoning.",
      keywords: ["inference", "uncertainty", "estimation", "testing", "models"],
      likely_has_children: true,
      child_scope_label: "branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Computer science",
      aliases: ["theoretical computer science", "computing science"],
      summary: "The study of computation, algorithms, formal languages, data structures, and computational systems.",
      why_it_belongs: "Computer science belongs in the formal sciences because its foundations are algorithmic, symbolic, and mathematically formal.",
      keywords: ["algorithms", "computation", "formal languages", "complexity", "data structures"],
      likely_has_children: true,
      child_scope_label: "branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Systems science",
      aliases: ["systems theory"],
      summary: "The formal study of organized systems, interactions, structure, feedback, and general systemic behavior.",
      why_it_belongs: "Systems science belongs here because it studies general formal patterns of organization and interaction across domains.",
      keywords: ["systems", "feedback", "organization", "interaction", "models"],
      likely_has_children: true,
      child_scope_label: "branches",
      taxonomy_role: "field",
      confidence: "medium",
      caution_note: "This field overlaps with applied and interdisciplinary domains, so later expansions should keep boundaries explicit.",
    },
    {
      name: "Decision theory",
      aliases: [],
      summary: "The formal study of rational choice, preference, utility, and decision under certainty or uncertainty.",
      why_it_belongs: "Decision theory belongs here because it formalizes choice, preference, and rational action using abstract models.",
      keywords: ["choice", "utility", "preference", "uncertainty", "rationality"],
      likely_has_children: true,
      child_scope_label: "branches",
      taxonomy_role: "field",
      confidence: "medium",
      caution_note: "This field also overlaps with economics, philosophy, and cognitive science.",
    },
  ],
  "Natural sciences": [
    {
      name: "Physics",
      aliases: [],
      summary: "The study of matter, energy, motion, force, fields, and the fundamental structure of the physical universe.",
      why_it_belongs: "Physics is a primary natural science focused on the most general physical laws and structures.",
      keywords: ["matter", "energy", "force", "fields", "laws"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Chemistry",
      aliases: [],
      summary: "The study of substances, composition, reaction, bonding, and transformation at molecular and atomic scales.",
      why_it_belongs: "Chemistry is a central natural science concerned with the composition and transformation of matter.",
      keywords: ["matter", "reaction", "bonding", "molecules", "transformation"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Biology",
      aliases: ["life sciences"],
      summary: "The study of living systems, organisms, heredity, development, evolution, and biological organization.",
      why_it_belongs: "Biology is a principal natural science because it studies life and living organization directly.",
      keywords: ["life", "organisms", "evolution", "heredity", "cells"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Earth science",
      aliases: ["geoscience"],
      summary: "The study of Earth systems, geology, atmosphere, oceans, and planetary-scale processes of the Earth.",
      why_it_belongs: "Earth science belongs here because it studies the natural systems and material history of the Earth.",
      keywords: ["geology", "atmosphere", "oceans", "earth systems", "planet"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Astronomy",
      aliases: ["astrophysics"],
      summary: "The study of celestial bodies, cosmic structure, and physical processes in the universe beyond Earth.",
      why_it_belongs: "Astronomy belongs here because it studies the natural universe at cosmic scales.",
      keywords: ["stars", "galaxies", "cosmos", "observation", "universe"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
  ],
  "Social sciences": [
    {
      name: "Economics",
      aliases: [],
      summary: "The study of production, exchange, allocation, incentives, markets, and economic systems.",
      why_it_belongs: "Economics is a major social science concerned with allocation, incentives, and social systems of production and exchange.",
      keywords: ["markets", "allocation", "incentives", "production", "exchange"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Political science",
      aliases: [],
      summary: "The study of power, institutions, governance, states, political behavior, and public decision-making.",
      why_it_belongs: "Political science belongs here because it studies institutions of power, governance, and collective decision-making.",
      keywords: ["power", "governance", "institutions", "state", "politics"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Sociology",
      aliases: [],
      summary: "The study of social structure, institutions, culture, inequality, and collective human behavior.",
      why_it_belongs: "Sociology is a core social science because it studies patterned social relations and institutions.",
      keywords: ["society", "institutions", "culture", "inequality", "social structure"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Anthropology",
      aliases: [],
      summary: "The study of human beings across cultures, history, language, society, and biological variation.",
      why_it_belongs: "Anthropology belongs here because it studies human life comparatively across social and cultural settings.",
      keywords: ["culture", "human variation", "ethnography", "society", "language"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Psychology",
      aliases: [],
      summary: "The study of mind, behavior, cognition, development, emotion, and mental processes.",
      why_it_belongs: "Psychology belongs here because it studies individual behavior and mental processes within human and animal life.",
      keywords: ["mind", "behavior", "cognition", "emotion", "development"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
  ],
  Philosophy: [
    {
      name: "Metaphysics",
      aliases: [],
      summary: "The study of being, existence, objects, properties, causation, time, and the basic structure of reality.",
      why_it_belongs: "Metaphysics is one of the central branches of philosophy because it asks what exists and how reality is structured.",
      keywords: ["existence", "reality", "causation", "time", "being"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Epistemology",
      aliases: [],
      summary: "The study of knowledge, belief, justification, evidence, skepticism, and rational inquiry.",
      why_it_belongs: "Epistemology is a core branch of philosophy because it studies what knowledge is and how it is possible.",
      keywords: ["knowledge", "belief", "justification", "evidence", "skepticism"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Ethics",
      aliases: ["moral philosophy"],
      summary: "The study of value, moral judgment, obligation, virtue, right action, and the good life.",
      why_it_belongs: "Ethics is a fundamental branch of philosophy because it studies value and moral evaluation.",
      keywords: ["morality", "value", "obligation", "virtue", "justice"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Logic",
      aliases: ["philosophical logic"],
      summary: "The study of inference, argument form, consequence, validity, and formal reasoning within philosophical analysis.",
      why_it_belongs: "Logic belongs here because it is both a formal science and a foundational branch of philosophy.",
      keywords: ["argument", "validity", "inference", "reasoning", "consequence"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "This field overlaps strongly with the formal-science branch of logic.",
    },
    {
      name: "Aesthetics",
      aliases: [],
      summary: "The study of beauty, art, taste, interpretation, and aesthetic experience.",
      why_it_belongs: "Aesthetics belongs here because it studies artistic value and aesthetic judgment as philosophical problems.",
      keywords: ["art", "beauty", "taste", "interpretation", "experience"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
    {
      name: "Philosophy of science",
      aliases: [],
      summary: "The study of scientific explanation, theory, evidence, confirmation, realism, and the logic of inquiry.",
      why_it_belongs: "Philosophy of science belongs here because it reflects critically on the structure and justification of science itself.",
      keywords: ["science", "explanation", "theory", "evidence", "realism"],
      likely_has_children: true,
      child_scope_label: "major branches",
      taxonomy_role: "field",
      confidence: "high",
      caution_note: "",
    },
  ],
};


const BREADTH_TARGETS = {
  compact: "6 to 10",
  broad: "10 to 16",
  maximal: "14 to 22",
};

const ROLE_VALUES = ["domain", "field", "subfield", "specialty", "topic", "concept_family"];
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

async function callOpenAI({
  apiKey,
  prompt,
  schemaName,
  schema,
  maxOutputTokens = 1200,
  reasoningEffort = "low",
  timeoutMs = 40000,
}) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey) {
    throw new Error("OPENAI_API_KEY is not set on the server.");
  }

  const attempts = [
    { maxOutputTokens, reasoningEffort, timeoutMs },
    {
      maxOutputTokens: Math.min(maxOutputTokens, 800),
      reasoningEffort: "low",
      timeoutMs: Math.min(timeoutMs, 25000),
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolvedApiKey}`,
        },
        signal: AbortSignal.timeout(attempt.timeoutMs),
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5-mini",
          input: prompt,
          max_output_tokens: attempt.maxOutputTokens,
          reasoning: {
            effort: attempt.reasoningEffort,
          },
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
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        const timeoutError = new Error(
          "The model request took too long for the current Vercel function window. Try a narrower topic or compact coverage mode.",
        );
        timeoutError.statusCode = 504;
        lastError = timeoutError;
      } else {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("OpenAI request failed.");
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

const BLOCKED_TAXONOMY_PATTERNS = [
  /\btextbooks?\b/i,
  /\btutorial papers?\b/i,
  /\bmonographs?\b/i,
  /\bsurvey articles?\b/i,
  /\bhandbooks?\b/i,
  /\bdictionaries\b/i,
  /\bbibliograph/i,
  /\bconference\b/i,
  /\bproceedings\b/i,
  /\bcollections?\b/i,
  /\bsoftware\b/i,
  /\bsource code\b/i,
  /\bresearch data\b/i,
  /\bproblem books?\b/i,
  /\bexternal book reviews?\b/i,
  /\bnone of the above\b/i,
  /\bgeneral and miscellaneous\b/i,
];

function sanitizeTaxonomyItem(item) {
  return {
    ...item,
    name: normalizeWhitespace(item.name),
    aliases: uniqueStrings(item.aliases || []),
    summary: normalizeWhitespace(item.summary),
    why_it_belongs: normalizeWhitespace(item.why_it_belongs),
    keywords: uniqueStrings(item.keywords || []).slice(0, 6),
    child_scope_label: normalizeWhitespace(item.child_scope_label) || "subfields",
    caution_note: normalizeWhitespace(item.caution_note),
  };
}

function isSuspiciousTaxonomyItem(item, currentNode) {
  const name = normalizeWhitespace(item?.name);
  const summary = normalizeWhitespace(item?.summary);
  const whyItBelongs = normalizeWhitespace(item?.why_it_belongs);
  const confidence = normalizeName(item?.confidence || "");
  const role = normalizeName(item?.taxonomy_role || "");

  if (!name || !summary || !whyItBelongs) {
    return true;
  }

  if (normalizeName(name) === normalizeName(currentNode)) {
    return true;
  }

  if (name.length > 90) {
    return true;
  }

  if (confidence === "low") {
    return true;
  }

  if ((role === "topic" || role === "concept_family") && name.split(/\s+/).length > 3) {
    return true;
  }

  return BLOCKED_TAXONOMY_PATTERNS.some((pattern) =>
    pattern.test(name) || pattern.test(summary) || pattern.test(whyItBelongs),
  );
}

function filterNearDuplicateItems(items, existingChildren, currentNode) {
  const existingLabels = uniqueStrings(existingChildren);
  const acceptedLabels = [...existingLabels];
  const acceptedItems = [];
  const droppedNames = [];

  for (const item of items) {
    const cleanedItem = sanitizeTaxonomyItem(item);
    if (isSuspiciousTaxonomyItem(cleanedItem, currentNode)) {
      droppedNames.push(cleanedItem.name || item.name || "Unknown item");
      continue;
    }

    const aliases = makeAliasList(cleanedItem);
    const itemLabels = aliases.length ? aliases : [cleanedItem.name];
    const duplicate = itemLabels.some((label) => hasNearDuplicate(label, acceptedLabels));

    if (duplicate) {
      droppedNames.push(cleanedItem.name);
      continue;
    }

    acceptedItems.push(cleanedItem);
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
  const currentLevel = pathSegments.length;
  const childLevel = currentLevel + 1;
  const childLevelLabel = childLevel === 2
    ? "Level 2 fields"
    : childLevel === 3
      ? "Level 3 subfields"
      : "Level 4 specialties, topic families, or precise research keywords";

  return [
    "You are building a high-coverage taxonomy of all areas of human knowledge for an interactive explorer.",
    "Return only DIRECT child categories of the target node.",
    "Do not return grandchildren.",
    `The current node is Level ${currentLevel}; return ${childLevelLabel}.`,
    "The app stops at Level 4, so Level 4 items should be precise scholarly keyword areas that are useful in catalogs and academic indexes.",
    "Prefer canonical academic branches, recognized subdisciplines, or recognized specialty areas.",
    "Be conservative. If uncertain, omit the item rather than inventing a dubious discipline.",
    "Do not return meta-categories about textbooks, proceedings, surveys, bibliography, software, history, or general reference material.",
    "Do not return named theorems, individual models, single methods, or fashionable buzzwords when a stable field or subfield is expected.",
    "Avoid duplicate or near-duplicate labels, abbreviations that duplicate full names, and singular/plural variants of the same concept.",
    "Keep all returned children at the same level of abstraction.",
    "Do not mix disciplines with methods, institutions, named theories, or example case studies unless the current node is already narrow enough that those are the correct direct children.",
    "If mode is 'find_more', focus only on plausible missing siblings not already listed.",
    "Only use confidence 'high' or 'medium'. Omit anything that would only deserve 'low'.",
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
    "- keywords: three to six precise search keywords; include discipline terms, not prose phrases",
    `- likely_has_children: ${childLevel < 4 ? "true when the item can be expanded further" : "false for Level 4 items"}`,
    "- child_scope_label: short phrase like 'subfields', 'branches', 'specialties', or 'concept families'",
    "- taxonomy_role: one of domain, field, subfield, specialty, topic, concept_family",
    "- confidence: high, medium, or low",
    "- caution_note: leave empty unless there is a real ambiguity or overlap worth flagging",
    "",
    "For Level 3 and Level 4, keywords must work well when combined with the parent Level 1 and Level 2 terms.",
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
        maxItems: 24,
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

function sentence(value, fallback) {
  const cleaned = normalizeWhitespace(value);
  return cleaned || fallback;
}

function currentNodeLabel(pathSegments) {
  return Array.isArray(pathSegments) && pathSegments.length
    ? pathSegments[pathSegments.length - 1]
    : "";
}

function titleFromPath(pathSegments) {
  return pathSegments[pathSegments.length - 1] || "This topic";
}

function fallbackTaxonomyChildren(pathSegments) {
  const topic = titleFromPath(pathSegments);
  const lowerTopic = normalizeName(topic);

  const byTopic = {
    mathematics: [
      "Algebra",
      "Analysis",
      "Geometry and Topology",
      "Number Theory",
      "Probability",
      "Applied Mathematics",
    ],
    logic: [
      "Philosophical Logic",
      "Mathematical Logic",
      "Proof Theory",
      "Model Theory",
      "Computability Theory",
      "Logic and Language",
    ],
    "computer science": [
      "Algorithms and Complexity",
      "Programming Languages",
      "Systems and Architecture",
      "Artificial Intelligence",
      "Theory of Computation",
      "Human-Computer Interaction",
    ],
    statistics: [
      "Probability Theory",
      "Statistical Inference",
      "Bayesian Statistics",
      "Applied Statistics",
      "Causal Inference",
      "Experimental Design",
    ],
    physics: [
      "Classical Mechanics",
      "Electromagnetism",
      "Quantum Physics",
      "Statistical Physics",
      "Relativity",
      "Condensed Matter Physics",
    ],
    chemistry: [
      "Organic Chemistry",
      "Inorganic Chemistry",
      "Physical Chemistry",
      "Analytical Chemistry",
      "Biochemistry",
      "Materials Chemistry",
    ],
    biology: [
      "Molecular Biology",
      "Cell Biology",
      "Genetics",
      "Evolutionary Biology",
      "Ecology",
      "Physiology",
    ],
    economics: [
      "Microeconomics",
      "Macroeconomics",
      "Econometrics",
      "Development Economics",
      "Political Economy",
      "Behavioral Economics",
    ],
    sociology: [
      "Social Theory",
      "Cultural Sociology",
      "Political Sociology",
      "Economic Sociology",
      "Sociology of Institutions",
      "Sociology of Inequality",
    ],
    psychology: [
      "Cognitive Psychology",
      "Developmental Psychology",
      "Social Psychology",
      "Clinical Psychology",
      "Neuropsychology",
      "Psychometrics",
    ],
    philosophy: [
      "Metaphysics",
      "Epistemology",
      "Ethics",
      "Logic",
      "Aesthetics",
      "Philosophy of Science",
    ],
    metaphysics: [
      "Ontology",
      "Causation",
      "Time and Persistence",
      "Modality",
      "Identity",
      "Mind and Reality",
    ],
    epistemology: [
      "Knowledge",
      "Justification",
      "Evidence",
      "Skepticism",
      "Rationality",
      "Social Epistemology",
    ],
    ethics: [
      "Normative Ethics",
      "Metaethics",
      "Applied Ethics",
      "Virtue Ethics",
      "Political Ethics",
      "Moral Psychology",
    ],
  };

  const names = byTopic[lowerTopic] || [
    `${topic} Theory`,
    `${topic} Methods`,
    `History of ${topic}`,
    `${topic} Applications`,
    `${topic} Foundations`,
    `Contemporary ${topic}`,
  ];

  return names.map((name) => ({
    name,
    aliases: [],
    summary: `${name} as a direct branch or organizing lens within ${topic}.`,
    why_it_belongs: `${name} helps structure the topic ${topic} into a coherent first layer for exploration.`,
    keywords: uniqueStrings([topic, ...name.split(" ").slice(0, 4)]).slice(0, 5),
    likely_has_children: true,
    child_scope_label: "related fields",
    taxonomy_role: "subfield",
    confidence: "medium",
    caution_note: "",
  }));
}

function fallbackBibliography(pathSegments, summary, keywords) {
  const topic = titleFromPath(pathSegments);
  const baseSource = sentence(summary, `${topic} as a field of study.`);
  const keywordText = uniqueStrings(keywords).slice(0, 4).join(", ");

  const makeEntry = (title, why, confidence = "low") => ({
    authors: "Fallback atlas entry",
    title,
    year: "Check source",
    source: "Use library catalogs, Google Scholar, JSTOR, PhilPapers, Crossref, and OpenAlex to verify.",
    why_it_matters: why,
    confidence,
  });

  return {
    note: `Starter reading guide for ${topic}. Use it as a first pass while you refine the field map.`,
    caution_note:
      "Treat these entries as a reading scaffold and verify exact editions or citations in library catalogs and scholarly indexes.",
    categories: {
      seminal_works: [
        makeEntry(
          `${topic}: early field-defining works`,
          `Start by locating classic works that established the central questions of ${topic}. ${baseSource}`,
        ),
      ],
      breakthrough_works: [
        makeEntry(
          `${topic}: breakthrough papers and turning points`,
          `Look for papers or books widely described as changing the direction of ${topic}. Keywords: ${keywordText || topic}.`,
        ),
      ],
      pedagogy_texts: [
        makeEntry(
          `${topic}: introductory textbooks and teaching texts`,
          `Use pedagogy-first works to build vocabulary and conceptual structure before reading specialist literature.`,
          "medium",
        ),
      ],
      reference_works: [
        makeEntry(
          `${topic}: handbooks, companions, and surveys`,
          `Reference works help you map the field before going deep into one subproblem.`,
          "medium",
        ),
      ],
      recent_syntheses: [
        makeEntry(
          `${topic}: recent syntheses and state-of-the-field reviews`,
          `Recent surveys can show how the field is currently organized and what debates or open problems matter now.`,
        ),
      ],
    },
  };
}

function fallbackConceptMap(pathSegments, summary, keywords) {
  const topic = titleFromPath(pathSegments);
  const keywordList = uniqueStrings(keywords).slice(0, 4);
  return {
    note: `Starter concept map for ${topic}. This gives you a stable first learning path for the topic.`,
    caution_note:
      "Use this roadmap as an orientation layer, then refine it by opening nearby fields and bibliography.",
    prerequisites: uniqueStrings([
      `Basic orientation to ${topic}`,
      `Key terms and vocabulary in ${topic}`,
      "How the field defines its central objects or problems",
      "How arguments or evidence are typically evaluated",
    ]).slice(0, 6),
    learning_stages: {
      beginner: [
        {
          name: `Foundational questions in ${topic}`,
          summary: `Start with the central questions, scope, and vocabulary that define ${topic}.`,
        },
        {
          name: `${topic} core terminology`,
          summary: "Learn the main terms, distinctions, and canonical formulations used in the field.",
        },
      ],
      intermediate: [
        {
          name: `${topic} major frameworks`,
          summary: "Study the leading frameworks, schools, or methodological approaches that organize the area.",
        },
        {
          name: `${topic} debates and methods`,
          summary: "Understand how arguments are made, what counts as evidence, and which debates structure the field.",
        },
      ],
      advanced: [
        {
          name: `${topic} frontier problems`,
          summary: "Move from standard formulations into current tensions, unresolved problems, or research programs.",
        },
        {
          name: `${topic} synthesis with nearby fields`,
          summary: `Study how ${topic} interacts with adjacent areas such as ${keywordList.join(", ") || "its neighboring fields"}.`,
        },
      ],
    },
    milestone_capabilities: [
      `Explain the basic scope and purpose of ${topic}.`,
      `Identify core concepts, major frameworks, and canonical questions in ${topic}.`,
      `Read an introductory text in ${topic} without losing the overall structure.`,
      `Distinguish foundational works from pedagogical and survey literature in ${topic}.`,
    ],
    bibliography_by_level: {
      pedagogy_texts: fallbackBibliography(pathSegments, summary, keywords).categories.pedagogy_texts,
      seminal_works: fallbackBibliography(pathSegments, summary, keywords).categories.seminal_works,
      breakthrough_works: fallbackBibliography(pathSegments, summary, keywords).categories.breakthrough_works,
      advanced_syntheses: fallbackBibliography(pathSegments, summary, keywords).categories.reference_works,
    },
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
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

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
      apiKey,
      prompt: taxonomyPrompt({
        pathSegments,
        existingChildren,
        breadth,
        customFocus,
        mode,
      }),
      schemaName: "science_taxonomy_children",
      schema: taxonomySchema(),
      maxOutputTokens: 1100,
      reasoningEffort: "low",
      timeoutMs: 30000,
    });

    const { acceptedItems, droppedNames } = filterNearDuplicateItems(
      payload.items,
      existingChildren,
      currentNodeLabel(pathSegments),
    );

    sendJson(res, 200, {
      path: pathSegments,
      overview: payload.overview,
      remaining_note: payload.remaining_note,
      dropped_duplicates: droppedNames,
      items: acceptedItems,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Unable to generate taxonomy for this branch right now.",
    });
  }
}

async function handleBibliographyRequest(req, res) {
  let pathSegments = [];
  let summary = "";
  let keywords = [];
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    pathSegments = Array.isArray(body.path)
      ? body.path.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!pathSegments.length) {
      sendJson(res, 400, { error: "Bibliography requests require a non-empty taxonomy path." });
      return;
    }

    summary = typeof body.summary === "string" ? body.summary.trim() : "";
    keywords = Array.isArray(body.keywords) ? body.keywords.map(String) : [];

    const payload = await callOpenAI({
      prompt: bibliographyPrompt({ pathSegments, summary, keywords }),
      schemaName: "categorized_seminal_bibliography",
      schema: bibliographySchema(),
      maxOutputTokens: 1200,
      reasoningEffort: "low",
      timeoutMs: 30000,
    });

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 200, fallbackBibliography(pathSegments, summary, keywords));
  }
}

async function handleConceptTreeRequest(req, res) {
  let pathSegments = [];
  let summary = "";
  let keywords = [];
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    pathSegments = Array.isArray(body.path)
      ? body.path.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!pathSegments.length) {
      sendJson(res, 400, { error: "Concept-tree requests require a non-empty taxonomy path." });
      return;
    }

    summary = typeof body.summary === "string" ? body.summary.trim() : "";
    keywords = Array.isArray(body.keywords) ? body.keywords.map(String) : [];

    const payload = await callOpenAI({
      prompt: conceptTreePrompt({ pathSegments, summary, keywords }),
      schemaName: "concept_tree_learning_map",
      schema: conceptsSchema(),
      maxOutputTokens: 1300,
      reasoningEffort: "low",
      timeoutMs: 32000,
    });

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 200, fallbackConceptMap(pathSegments, summary, keywords));
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
