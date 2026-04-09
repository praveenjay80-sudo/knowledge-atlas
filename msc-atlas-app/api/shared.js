const fs = require("fs");
const path = require("path");

const SECTION_PATTERN = /^(?<code>\d{2})-XX$/;
const BRANCH_PATTERN = /^(?<code>\d{2}[A-Z])xx$/;
const LEAF_PATTERN = /^(?<code>\d{2}[A-Z]\d{2})$/;
const AUXILIARY_PATTERN = /^(?<code>\d{2}-\d{2})$/;

let cachedCatalog = null;
const cachedZbMathInsights = new Map();
const ZBMATH_API_BASE = process.env.ZBMATH_API_BASE || "https://api.zbmath.org";
const ZBMATH_TNC_AGREED = process.env.ZBMATH_TNC_AGREED || "1";
const ZBMATH_RESULTS_PER_PAGE = 24;

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

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function callOpenAI({ prompt, schemaName, schema, maxOutputTokens = 2200, reasoningEffort = "low" }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the server.");
  }

  const attempts = [
    { maxOutputTokens, reasoningEffort },
    { maxOutputTokens: Math.min(maxOutputTokens, 1200), reasoningEffort: "low" },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
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
      throw new Error(data?.error?.message || "OpenAI API request failed.");
    }

    if (data?.status === "incomplete") {
      lastError = new Error("The model response was incomplete. Retrying with a smaller payload.");
      continue;
    }

    const text = extractResponseText(data);
    if (!text) {
      lastError = new Error("OpenAI returned no structured output.");
      continue;
    }

    const parsed = safeParseJson(text);
    if (parsed.ok) {
      return parsed.value;
    }

    lastError = new Error("The model returned malformed structured output. Retrying with a smaller payload.");
  }

  throw lastError || new Error("OpenAI did not return valid structured output.");
}

function parseTsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "\t" && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.replace(/\r/g, "").trim());
}

function cleanText(value) {
  return String(value || "")
    .replace(/\{+/g, "(")
    .replace(/\}+/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized.endsWith("XX") && normalized.length === 5) {
    return normalized.slice(0, 3);
  }
  if (normalized.endsWith("-XX") && normalized.length === 5) {
    return normalized.slice(0, 2);
  }
  return normalized;
}

function classifyCode(officialCode) {
  if (SECTION_PATTERN.test(officialCode)) {
    return { code: officialCode.slice(0, 2), level: "section", parentCode: null };
  }
  if (BRANCH_PATTERN.test(officialCode)) {
    return { code: officialCode.slice(0, 3), level: "branch", parentCode: officialCode.slice(0, 2) };
  }
  if (LEAF_PATTERN.test(officialCode)) {
    return { code: officialCode, level: "leaf", parentCode: officialCode.slice(0, 3) };
  }
  if (AUXILIARY_PATTERN.test(officialCode)) {
    return { code: officialCode, level: "auxiliary", parentCode: officialCode.slice(0, 2) };
  }
  return null;
}

function loadCatalog() {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const filePath = path.join(__dirname, "..", "data", "MSC_2020.csv");
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const header = parseTsvLine(lines[0]);
  const codeIndex = header.indexOf("code");
  const textIndex = header.indexOf("text");
  const descriptionIndex = header.indexOf("description");

  const tempRecords = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseTsvLine(line);
    const officialCode = cleanText(cells[codeIndex]);
    if (!officialCode) {
      continue;
    }

    const classification = classifyCode(officialCode);
    if (!classification) {
      continue;
    }

    const title = cleanText(cells[textIndex] || cells[descriptionIndex]);
    const description = cleanText(cells[descriptionIndex] || title);
    tempRecords.set(classification.code, {
      code: classification.code,
      title,
      description,
      officialCode,
      level: classification.level,
      parentCode: classification.parentCode,
    });
  }

  const children = new Map();
  for (const record of tempRecords.values()) {
    const key = record.parentCode || "__root__";
    if (!children.has(key)) {
      children.set(key, []);
    }
    children.get(key).push(record.code);
  }

  for (const childCodes of children.values()) {
    childCodes.sort();
  }

  const levelCounts = { section: 0, branch: 0, leaf: 0, auxiliary: 0 };
  const records = new Map();
  for (const [code, record] of [...tempRecords.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const parent = record.parentCode ? tempRecords.get(record.parentCode) : null;
    const childCount = (children.get(code) || []).length;
    levelCounts[record.level] += 1;
    records.set(code, {
      ...record,
      parentTitle: parent?.title || "",
      childCount,
      isLeaf: childCount === 0,
    });
  }

  cachedCatalog = {
    records,
    children,
    officialRowCount: lines.length - 1,
    levelCounts,
  };

  return cachedCatalog;
}

function toNodeSummary(record) {
  return {
    code: record.code,
    title: record.title,
    description: record.description,
    official_code: record.officialCode,
    level: record.level,
    parent_code: record.parentCode,
    parent_title: record.parentTitle,
    child_count: record.childCount,
    is_leaf: record.isLeaf,
  };
}

function buildLineage(code) {
  const { records } = loadCatalog();
  const lineage = [];
  let current = records.get(code);
  while (current) {
    lineage.push({
      code: current.code,
      title: current.title,
      level: current.level,
    });
    current = current.parentCode ? records.get(current.parentCode) : null;
  }
  return lineage.reverse();
}

function getRootNodes() {
  const { records, children } = loadCatalog();
  return (children.get("__root__") || []).map((code) => toNodeSummary(records.get(code)));
}

function getNodeDetail(code) {
  const { records } = loadCatalog();
  const normalized = normalizeCode(code);
  const record = records.get(normalized);
  if (!record) {
    return null;
  }

  return {
    ...toNodeSummary(record),
    lineage: buildLineage(normalized),
  };
}

function getChildren(code) {
  const { records, children } = loadCatalog();
  const normalized = normalizeCode(code);
  return (children.get(normalized) || []).map((childCode) => toNodeSummary(records.get(childCode)));
}

function searchCatalog(query, limit = 18) {
  const normalized = String(query || "").trim().toLowerCase();
  const { records } = loadCatalog();
  const matches = [...records.values()].filter((record) => {
    if (!normalized) {
      return true;
    }
    return [record.code, record.title, record.description, record.parentTitle]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });

  return {
    total: matches.length,
    items: matches.slice(0, limit).map(toNodeSummary),
  };
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeLabel(value) {
  return normalizeLabel(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

const GENERIC_VOCAB_TOKENS = new Set([
  "and",
  "for",
  "from",
  "into",
  "mathematics",
  "mathematical",
  "method",
  "methods",
  "science",
  "sciences",
  "study",
  "studies",
  "system",
  "systems",
  "theory",
  "theories",
]);

function distinctiveTokens(value) {
  const tokens = tokenizeLabel(value).filter((token) => token.length > 2);
  const filtered = tokens.filter((token) => !GENERIC_VOCAB_TOKENS.has(token));
  return filtered.length ? filtered : tokens;
}

function matchType(query, candidate) {
  const left = normalizeLabel(query);
  const right = normalizeLabel(candidate);
  if (left === right) {
    return "exact";
  }
  if (left && right && (left.includes(right) || right.includes(left))) {
    return "close";
  }
  return "search";
}

function vocabularyScore(query, candidate) {
  const left = normalizeLabel(query);
  const right = normalizeLabel(candidate);
  if (!left || !right) {
    return -1;
  }

  if (left === right) {
    return 100;
  }

  let score = 0;
  if (right.startsWith(left) || left.startsWith(right)) {
    score += 45;
  } else if (right.includes(left) || left.includes(right)) {
    score += 30;
  }

  const queryTokens = distinctiveTokens(query);
  const candidateTokens = new Set(tokenizeLabel(candidate));
  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  const ratio = overlap / Math.max(queryTokens.length, 1);
  score += ratio * 40;

  if (queryTokens.length > 0 && overlap === queryTokens.length) {
    score += 20;
  }

  return score;
}

function keepVocabularyCandidate(query, candidate) {
  const score = vocabularyScore(query, candidate);
  const exactness = matchType(query, candidate);
  if (exactness === "exact" || exactness === "close") {
    return score >= 35;
  }

  const queryTokens = distinctiveTokens(query);
  const candidateTokens = new Set(tokenizeLabel(candidate));
  const overlap = queryTokens.filter((token) => candidateTokens.has(token)).length;

  if (!queryTokens.length) {
    return score >= 40;
  }

  return overlap === queryTokens.length && score >= 45;
}

function finalizeVocabularyTerms(query, terms, emptyMessage) {
  const deduped = [];
  const seen = new Set();

  for (const term of terms) {
    const labelKey = normalizeLabel(term.label);
    if (!labelKey || seen.has(labelKey)) {
      continue;
    }
    const score = vocabularyScore(query, term.label);
    if (!keepVocabularyCandidate(query, term.label)) {
      continue;
    }
    seen.add(labelKey);
    deduped.push({
      ...term,
      vocabulary_score: score,
    });
  }

  deduped.sort((left, right) => right.vocabulary_score - left.vocabulary_score);

  return {
    terms: deduped.slice(0, 4).map(({ vocabulary_score, ...term }) => term),
    warning: deduped.length ? "" : emptyMessage,
  };
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractLobidLabels(items) {
  return getArray(items)
    .map((item) => cleanText(item?.label || item))
    .filter(Boolean);
}

function looksLikeEnglishVariant(value) {
  const text = cleanText(value);
  if (!text) {
    return false;
  }

  if (/[äöüß]/i.test(text)) {
    return false;
  }

  return /[a-z]/i.test(text);
}

function extractEnglishVariants(heading, variants) {
  const headingKey = normalizeLabel(heading);
  const seen = new Set();
  const english = [];

  for (const variant of variants) {
    const cleaned = cleanText(variant);
    const key = normalizeLabel(cleaned);
    if (!cleaned || !key || key === headingKey || seen.has(key)) {
      continue;
    }
    if (!looksLikeEnglishVariant(cleaned)) {
      continue;
    }
    seen.add(key);
    english.push(cleaned);
  }

  return english.slice(0, 4);
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MSC-Math-Atlas/1.0",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.text();
}

async function lookupLcsh(label) {
  const searchUrl = `https://id.loc.gov/search/?q=${encodeURIComponent(label)}&q=${encodeURIComponent("cs:http://id.loc.gov/authorities/subjects")}`;

  try {
    const html = await fetchText(searchUrl, {
      Accept: "text/html,application/xhtml+xml",
    });
    const matches = [...html.matchAll(/href="(?<href>(?:https?:\/\/id\.loc\.gov|\/authorities\/subjects\/)[^"#?]+)"[^>]*>(?<label>.*?)<\/a>/gi)];
    const seen = new Set();
    const terms = [];

    for (const match of matches) {
      const href = match.groups?.href || "";
      if (!href.includes("/authorities/subjects/")) {
        continue;
      }
      const uri = href.startsWith("http") ? href : `https://id.loc.gov${href}`;
      const identifier = uri.split("/").pop();
      const candidate = cleanText(String(match.groups?.label || "").replace(/<[^>]+>/g, " "));
      if (!identifier || !candidate || seen.has(identifier)) {
        continue;
      }
      seen.add(identifier);
      terms.push({
        scheme: "lcsh",
        label: candidate,
        identifier,
        uri,
        source_url: `${uri}.html`,
        match_type: matchType(label, candidate),
        note: "",
      });
      if (terms.length >= 12) {
        break;
      }
    }

    const filtered = finalizeVocabularyTerms(
      label,
      terms,
      "No strong LCSH subject-heading match was found for this MSC label.",
    );

    return {
      scheme: "lcsh",
      heading: "Library of Congress Subject Headings",
      search_url: searchUrl,
      warning: filtered.warning,
      terms: filtered.terms,
    };
  } catch (error) {
    return {
      scheme: "lcsh",
      heading: "Library of Congress Subject Headings",
      search_url: searchUrl,
      warning: error.message,
      terms: [],
    };
  }
}

function parseGndRecords(xml) {
  return xml.split(/<record[^>]*>/i).slice(1).map((chunk) => chunk.split(/<\/record>/i)[0]);
}

function extractFirstSubfield(record, tag, code) {
  const pattern = new RegExp(
    `<datafield[^>]*tag="${tag}"[^>]*>[\\s\\S]*?<subfield[^>]*code="${code}"[^>]*>([\\s\\S]*?)<\\/subfield>`,
    "i",
  );
  const match = record.match(pattern);
  return cleanText(match?.[1] || "");
}

function extractControlField(record, tag) {
  const match = record.match(new RegExp(`<controlfield[^>]*tag="${tag}"[^>]*>([\\s\\S]*?)<\\/controlfield>`, "i"));
  return cleanText(match?.[1] || "");
}

function extractHeading(record) {
  for (const tag of ["150", "151", "155"]) {
    const blockMatch = record.match(new RegExp(`<datafield[^>]*tag="${tag}"[^>]*>([\\s\\S]*?)<\\/datafield>`, "i"));
    if (!blockMatch) {
      continue;
    }

    const values = [...blockMatch[1].matchAll(/<subfield[^>]*>([\s\S]*?)<\/subfield>/gi)]
      .map((item) => cleanText(item[1]))
      .filter(Boolean);

    if (values.length) {
      return values.join(" -- ");
    }
  }
  return "";
}

async function lookupGnd(label) {
  const searchUrl =
    "https://lobid.org/gnd/search?" +
    new URLSearchParams({
      q: label,
      filter: "type:SubjectHeading",
      format: "json",
      size: "10",
    }).toString();

  try {
    const payload = await fetchJson(searchUrl);
    const terms = [];
    const seen = new Set();

    for (const record of payload?.member || []) {
      const types = getArray(record?.type).map((item) => cleanText(item));
      if (!types.includes("SubjectHeading")) {
        continue;
      }

      const identifier = cleanText(record?.gndIdentifier);
      const heading = cleanText(record?.preferredName);
      if (!identifier || !heading || seen.has(identifier)) {
        continue;
      }
      seen.add(identifier);

      const variantNames = getArray(record?.variantName).map((item) => cleanText(item)).filter(Boolean);
      const englishVariants = extractEnglishVariants(heading, variantNames);
      const broaderLabels = [
        ...extractLobidLabels(record?.broaderTermGeneral),
        ...extractLobidLabels(record?.broaderTermGeneric),
      ];
      const categoryLabels = extractLobidLabels(record?.gndSubjectCategory);

      terms.push({
        scheme: "gnd",
        label: heading,
        identifier,
        uri: `https://d-nb.info/gnd/${identifier}`,
        source_url: `https://d-nb.info/gnd/${identifier}`,
        match_type: matchType(label, [heading, ...variantNames].join(" ")),
        english_labels: englishVariants,
        note: [
          englishVariants.length ? `English variants: ${englishVariants.join(", ")}` : "",
          categoryLabels.length ? `Categories: ${categoryLabels.join(", ")}` : "",
          broaderLabels.length ? `Broader terms: ${broaderLabels.join(", ")}` : "",
          variantNames.length ? `Variants: ${variantNames.slice(0, 4).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      });
    }

    const filtered = finalizeVocabularyTerms(
      label,
      terms,
      "No strong GND subject-heading match was found for this MSC label. GND often prefers German headings, so some English MSC labels will not have a direct match.",
    );

    return {
      scheme: "gnd",
      heading: "German National Library Subject Headings (GND)",
      search_url: searchUrl,
      warning: filtered.warning,
      terms: filtered.terms,
    };
  } catch (error) {
    return {
      scheme: "gnd",
      heading: "German National Library Subject Headings (GND)",
      search_url: searchUrl,
      warning: error.message,
      terms: [],
    };
  }
}

function buildZbMathUrl(apiPath, params = {}) {
  const baseUrl = new URL(apiPath, ZBMATH_API_BASE);
  baseUrl.searchParams.set("tnc_agreed", ZBMATH_TNC_AGREED);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    baseUrl.searchParams.set(key, String(value));
  }
  return baseUrl.toString();
}

async function fetchZbMathJson(apiPath, params = {}) {
  return fetchJson(buildZbMathUrl(apiPath, params));
}

function escapeZbMathTerm(value) {
  return cleanText(value).replace(/"/g, "");
}

function buildZbMathSearchString(node) {
  const codeTerm = node.code;
  const titleTerm = escapeZbMathTerm(node.title);
  return `cc:${codeTerm} | ti:"${titleTerm}"`;
}

function normalizeZbMathTitle(title) {
  if (typeof title === "string") {
    return cleanText(title);
  }
  if (title && typeof title === "object") {
    return cleanText(title.title || title.original || title.subtitle || "");
  }
  return "";
}

function normalizeZbMathSource(source) {
  if (!source || typeof source !== "object") {
    return "";
  }
  return cleanText(
    source.source
      || getArray(source.series).map((item) => item?.title || item?.short_title).find(Boolean)
      || getArray(source.serial).map((item) => item?.title || item?.short_title).find(Boolean)
      || getArray(source.book).map((item) => item?.publisher).find(Boolean)
      || "",
  );
}

function normalizeZbMathDocumentType(documentType) {
  if (!documentType || typeof documentType !== "object") {
    return "document";
  }
  return cleanText(documentType.description || documentType.code || "document");
}

function normalizeZbMathLinks(links, fallbackUrl) {
  const normalized = [];
  for (const link of getArray(links)) {
    const label = cleanText(link?.type || link?.identifier || "link");
    const url = cleanText(link?.url || (link?.type === "doi" && link?.identifier ? `https://doi.org/${link.identifier}` : ""));
    if (!url) {
      continue;
    }
    normalized.push({
      label: label === "doi" ? "DOI" : label,
      url,
    });
  }
  if (fallbackUrl && !normalized.some((link) => link.url === fallbackUrl)) {
    normalized.unshift({ label: "zbMATH record", url: fallbackUrl });
  }
  return normalized.slice(0, 5);
}

function normalizeZbMathDocument(document) {
  const keywords = getArray(document?.keywords).map((item) => cleanText(item)).filter(Boolean);
  const mscCodes = getArray(document?.msc)
    .map((item) => ({
      code: cleanText(item?.code),
      text: cleanText(item?.text),
    }))
    .filter((item) => item.code);

  return {
    id: cleanText(document?.id),
    title: normalizeZbMathTitle(document?.title) || "Untitled zbMATH document",
    year: safeInt(document?.year),
    authors: getArray(document?.contributors?.authors)
      .map((item) => cleanText(item?.name))
      .filter(Boolean),
    source: normalizeZbMathSource(document?.source),
    work_type: normalizeZbMathDocumentType(document?.document_type),
    keywords,
    msc: mscCodes,
    zbmath_url: cleanText(document?.zbmath_url),
    links: normalizeZbMathLinks(document?.links, cleanText(document?.zbmath_url)),
    review_excerpt: cleanText(getArray(document?.editorial_contributions).map((item) => item?.text).find(Boolean) || ""),
  };
}

function incrementCount(map, key, metadata = {}) {
  const cleanedKey = cleanText(key);
  if (!cleanedKey) {
    return;
  }
  const entry = map.get(cleanedKey) || { label: cleanedKey, count: 0, ...metadata };
  entry.count += 1;
  for (const [metaKey, metaValue] of Object.entries(metadata)) {
    if (metaValue !== undefined && metaValue !== null && metaValue !== "") {
      entry[metaKey] = metaValue;
    }
  }
  map.set(cleanedKey, entry);
}

function sortCountEntries(map, limit = 8) {
  return [...map.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function inferKeywordBucket(keyword) {
  const normalized = normalizeLabel(keyword);
  if (!normalized) {
    return "core_concepts";
  }

  if (/(method|methods|algorithm|algorithms|sieve|analysis|construction|proof|comput|approximation|optimization|decomposition)/.test(normalized)) {
    return "methods";
  }
  if (/(group|groups|ring|rings|field|fields|space|spaces|algebra|algebras|operator|operators|equation|equations|graph|graphs|module|modules|category|categories|matrix|matrices|logic|model|models)/.test(normalized)) {
    return "structures";
  }
  if (/(application|applications|network|signal|coding|computer|physics|biology|finance|learning|control|data|cryptography|game|games)/.test(normalized)) {
    return "applications";
  }
  return "core_concepts";
}

function toDisplayCode(code) {
  const rawCode = typeof code === "string" ? code : cleanText(code?.code || code?.label);
  const detail = getNodeDetail(rawCode);
  return {
    code: rawCode,
    title: detail?.title || cleanText(code?.title || ""),
    level: detail?.level || "",
  };
}

function buildKeywordBridgeItems(node, keywordEntries) {
  return keywordEntries.map((entry) => ({
    label: entry.label,
    count: entry.count,
    source_url: `https://zbmath.org/?q=${encodeURIComponent(`cc:${node.code} ut:"${entry.label}"`)}`,
    related_codes: (entry.related_codes || []).slice(0, 4).map(toDisplayCode),
    note: `Appears in ${entry.count} sampled zbMATH records for ${node.code} ${node.title}.`,
  }));
}

function buildReadingPath(node, foundationalTerms, clusters, advancedTerms, representativeWorks, relatedCodes) {
  const firstWork = representativeWorks[0];
  const secondWork = representativeWorks[1];
  return [
    {
      step: "1",
      title: "Orient the topic",
      summary: `Start with the MSC node itself and the most common literature terms attached to ${node.title}.`,
      keywords: foundationalTerms.slice(0, 4),
      bibliography_focus: firstWork ? `${firstWork.title}${firstWork.year ? ` (${firstWork.year})` : ""}` : node.title,
    },
    {
      step: "2",
      title: "Build the core concept layer",
      summary: "Use the most central keyword cluster as your early concept inventory.",
      keywords: getArray(clusters.core_concepts).slice(0, 5),
      bibliography_focus: node.title,
    },
    {
      step: "3",
      title: "Add methods and structures",
      summary: "Then move into the methods and structural objects that recur across the literature sample.",
      keywords: uniqueList([...getArray(clusters.methods), ...getArray(clusters.structures)], 6),
      bibliography_focus: secondWork ? secondWork.title : `${node.title} methods`,
    },
    {
      step: "4",
      title: "Move into research detail",
      summary: "Only after the core layer is stable should you push into narrower technical terms.",
      keywords: advancedTerms.slice(0, 5),
      bibliography_focus: `${node.title} advanced topics`,
    },
    {
      step: "5",
      title: "Branch into nearby areas",
      summary: "Use co-occurring MSC codes to identify adjacent areas worth learning next.",
      keywords: relatedCodes.slice(0, 4).map((item) => `${item.code}${item.title ? ` ${item.title}` : ""}`),
      bibliography_focus: `${node.title} related topics`,
    },
  ];
}

function buildLiteraturePanel(documents, keywordEntries, journalEntries, authorEntries) {
  const years = documents.map((item) => item.year).filter((value) => Number.isFinite(value));
  const documentTypes = new Map();
  for (const document of documents) {
    incrementCount(documentTypes, document.work_type);
  }

  return {
    sample_size: documents.length,
    year_span: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "Unknown",
    top_document_types: sortCountEntries(documentTypes, 4),
    top_keywords: keywordEntries.slice(0, 6).map((item) => ({ label: item.label, count: item.count })),
    top_journals: journalEntries.slice(0, 6).map((item) => ({ label: item.label, count: item.count })),
    top_authors: authorEntries.slice(0, 6).map((item) => ({ label: item.label, count: item.count })),
  };
}

function buildZbMathFeaturePayload(node, documents, classificationMeta, searchString, totalResults) {
  const keywordCounts = new Map();
  const authorCounts = new Map();
  const journalCounts = new Map();
  const relatedCodeCounts = new Map();
  const keywordToCodes = new Map();

  for (const document of documents) {
    for (const author of document.authors) {
      incrementCount(authorCounts, author);
    }
    if (document.source) {
      incrementCount(journalCounts, document.source);
    }
    for (const keyword of document.keywords) {
      incrementCount(keywordCounts, keyword);
      const relatedCodes = keywordToCodes.get(keyword) || new Map();
      for (const item of document.msc) {
        if (!item.code || item.code === node.code) {
          continue;
        }
        incrementCount(relatedCodes, item.code, { title: item.text });
      }
      keywordToCodes.set(keyword, relatedCodes);
    }
    for (const item of document.msc) {
      if (!item.code || item.code === node.code) {
        continue;
      }
      const detail = getNodeDetail(item.code);
      incrementCount(relatedCodeCounts, item.code, { title: detail?.title || item.text });
    }
  }

  const keywordEntries = sortCountEntries(keywordCounts, 14).map((entry) => ({
    ...entry,
    related_codes: sortCountEntries(keywordToCodes.get(entry.label) || new Map(), 4),
  }));
  const authorEntries = sortCountEntries(authorCounts, 8);
  const journalEntries = sortCountEntries(journalCounts, 8);
  const relatedCodes = sortCountEntries(relatedCodeCounts, 8).map((entry) => ({
    code: entry.label,
    title: entry.title || getNodeDetail(entry.label)?.title || "",
    count: entry.count,
  }));

  const foundationalTerms = keywordEntries
    .filter((entry) => tokenizeLabel(entry.label).length <= 2)
    .slice(0, 6)
    .map((entry) => entry.label);
  const advancedTerms = keywordEntries
    .filter((entry) => tokenizeLabel(entry.label).length >= 2)
    .slice(3, 9)
    .map((entry) => entry.label);
  const specialistTerms = keywordEntries
    .filter((entry) => tokenizeLabel(entry.label).length >= 3 || entry.count <= 2)
    .slice(0, 6)
    .map((entry) => entry.label);

  const keywordClusters = {
    core_concepts: [],
    methods: [],
    structures: [],
    applications: [],
  };
  for (const entry of keywordEntries) {
    keywordClusters[inferKeywordBucket(entry.label)].push(entry.label);
  }
  for (const key of Object.keys(keywordClusters)) {
    keywordClusters[key] = uniqueList(keywordClusters[key], 6);
  }

  const representativeWorks = [...documents]
    .sort((left, right) => {
      const leftBook = /book/i.test(left.work_type || "") ? 1 : 0;
      const rightBook = /book/i.test(right.work_type || "") ? 1 : 0;
      if (leftBook !== rightBook) {
        return rightBook - leftBook;
      }
      const leftYear = safeInt(left.year) || 9999;
      const rightYear = safeInt(right.year) || 9999;
      return leftYear - rightYear;
    })
    .slice(0, 8)
    .map((document) => ({
      id: document.id,
      title: document.title,
      year: document.year,
    authors: document.authors,
    source: document.source,
    work_type: document.work_type,
    keywords: document.keywords.slice(0, 6),
    related_codes: document.msc.slice(0, 5).map((item) => ({
      code: item.code,
      title: getNodeDetail(item.code)?.title || item.text || "",
    })),
    links: document.links,
    zbmath_url: document.zbmath_url,
    review_excerpt: document.review_excerpt,
  }));

  const bibliographyQueries = uniqueList([
    `${node.title}`,
    `${node.code} ${node.title}`,
    ...keywordEntries.slice(0, 4).map((entry) => `${node.title} ${entry.label}`),
  ], 6);

  return {
    official_api: {
      provider: "zbMATH Open REST API",
      terms_url: "https://api.zbmath.org/static/terms-and-conditions.html",
      classification_url: buildZbMathUrl(`/v1/classification/${encodeURIComponent(node.code)}`),
      documents_url: buildZbMathUrl("/v1/document/_search", {
        search_string: searchString,
        results_per_page: String(ZBMATH_RESULTS_PER_PAGE),
      }),
      search_string: searchString,
      total_results: totalResults,
      sampled_documents: documents.length,
      classification_label: classificationMeta?.result?.long_title || node.title,
    },
    phases: [
      {
        key: "phase_1",
        label: "Phase 1 · Official extraction",
        summary: "Directly pull zbMATH document data for the MSC node, then surface keywords, core works, and bibliography hints.",
        features: [
          {
            key: "real_keyword_extraction",
            label: "Real keyword extraction",
            description: "Actual zbMATH keyword fields aggregated from sampled documents returned by the official API.",
            type: "keyword_cards",
            items: buildKeywordBridgeItems(node, keywordEntries.slice(0, 10)),
          },
          {
            key: "representative_papers",
            label: "Representative papers and books",
            description: "Directly sampled zbMATH records that anchor the topic.",
            type: "works",
            items: representativeWorks,
          },
          {
            key: "bibliography_improvement",
            label: "Bibliography improvement",
            description: "These zbMATH-derived hints are also fed into Crossref/OpenAlex bibliography generation for MSC targets.",
            type: "lists",
            groups: [
              {
                label: "Suggested query expansions",
                items: bibliographyQueries.map((item) => ({ label: item })),
              },
            ],
          },
        ],
      },
      {
        key: "phase_2",
        label: "Phase 2 · Topic structure",
        summary: "Use the extracted keywords to build a concept bridge, fingerprint the field, and separate broad learning terms from research-level ones.",
        features: [
          {
            key: "keyword_to_concept_bridge",
            label: "Keyword-to-concept bridge",
            description: "Clickable keyword chips that can open concept-specific bibliography, a focused mastery guide, or nearby MSC areas.",
            type: "keyword_cards",
            items: buildKeywordBridgeItems(node, keywordEntries.slice(0, 8)),
          },
          {
            key: "topic_fingerprint",
            label: "Topic fingerprint",
            description: "A literature-derived snapshot of the field using the sampled zbMATH records.",
            type: "lists",
            groups: [
              { label: "Common keywords", items: keywordEntries.slice(0, 8).map((item) => ({ label: item.label, count: item.count })) },
              { label: "Neighboring keywords", items: keywordEntries.slice(8, 14).map((item) => ({ label: item.label, count: item.count })) },
              { label: "Recurring authors", items: authorEntries.map((item) => ({ label: item.label, count: item.count })) },
              { label: "Recurring journals or sources", items: journalEntries.map((item) => ({ label: item.label, count: item.count })) },
              { label: "Related MSC codes", items: relatedCodes.map((item) => ({ label: item.code, count: item.count, code: item.code, title: item.title })) },
            ],
          },
          {
            key: "beginner_vs_research_split",
            label: "Beginner vs research split",
            description: "Heuristic split based on keyword frequency, phrase length, and how narrow the sampled literature appears.",
            type: "lists",
            groups: [
              { label: "Foundational topic terms", items: foundationalTerms.map((item) => ({ label: item })) },
              { label: "Advanced research terms", items: advancedTerms.map((item) => ({ label: item })) },
              { label: "Specialist subtopics", items: specialistTerms.map((item) => ({ label: item })) },
            ],
          },
          {
            key: "keyword_clusters",
            label: "Keyword clusters",
            description: "Simple deterministic buckets that help turn the literature into study categories.",
            type: "lists",
            groups: [
              { label: "Core concepts", items: keywordClusters.core_concepts.map((item) => ({ label: item })) },
              { label: "Methods", items: keywordClusters.methods.map((item) => ({ label: item })) },
              { label: "Structures", items: keywordClusters.structures.map((item) => ({ label: item })) },
              { label: "Applications", items: keywordClusters.applications.map((item) => ({ label: item })) },
            ],
          },
        ],
      },
      {
        key: "phase_3",
        label: "Phase 3 · Navigation and mastery",
        summary: "Turn the extracted evidence into nearby-topic discovery, reading order, and a plain-language literature panel.",
        features: [
          {
            key: "related_topic_discovery",
            label: "Related-topic discovery",
            description: "Nearby MSC areas surfaced through co-occurrence in the sampled zbMATH records, not just the official tree.",
            type: "lists",
            groups: [
              {
                label: "Related MSC areas",
                items: relatedCodes.map((item) => ({ label: item.code, count: item.count, code: item.code, title: item.title })),
              },
            ],
          },
          {
            key: "reading_path_builder",
            label: "Reading-path builder",
            description: "A staged order that turns the field fingerprint into a study route.",
            type: "steps",
            items: buildReadingPath(node, foundationalTerms, keywordClusters, advancedTerms, representativeWorks, relatedCodes),
          },
          {
            key: "literature_panel",
            label: "What shows up in the literature?",
            description: "A compact panel showing how the topic currently appears in the sampled zbMATH records.",
            type: "facts",
            facts: buildLiteraturePanel(documents, keywordEntries, journalEntries, authorEntries),
          },
        ],
      },
    ],
  };
}

async function lookupControlledVocabulary(code) {
  const node = getNodeDetail(code);
  if (!node) {
    throw new Error("MSC 2020 code not found.");
  }

  if (cachedZbMathInsights.has(node.code)) {
    return cachedZbMathInsights.get(node.code);
  }

  const searchString = buildZbMathSearchString(node);
  const [classificationMeta, documentPayload] = await Promise.all([
    fetchZbMathJson(`/v1/classification/${encodeURIComponent(node.code)}`),
    fetchZbMathJson("/v1/document/_search", {
      search_string: searchString,
      results_per_page: String(ZBMATH_RESULTS_PER_PAGE),
      page: "0",
    }),
  ]);

  const documents = getArray(documentPayload?.result).map(normalizeZbMathDocument).filter((item) => item.title);
  const payload = {
    code: node.code,
    title: node.title,
    description: node.description,
    generated_at: new Date().toISOString(),
    ...buildZbMathFeaturePayload(
      node,
      documents,
      classificationMeta,
      searchString,
      safeInt(documentPayload?.status?.nr_total_results) || documents.length,
    ),
  };

  cachedZbMathInsights.set(node.code, payload);
  return payload;
}

function bibliographySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      caveats: { type: "array", items: { type: "string" } },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            entries: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  candidate_id: { type: "string" },
                  rationale: { type: "string" },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                  },
                },
                required: ["candidate_id", "rationale", "confidence"],
              },
            },
          },
          required: ["key", "label", "description", "entries"],
        },
      },
    },
    required: ["overview", "caveats", "sections"],
  };
}

function conceptEntrySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      explanation: { type: "string" },
      why_it_matters: { type: "string" },
      example: { type: "string" },
      modern_applications: { type: "array", items: { type: "string" } },
      reading_order: { type: "array", items: { type: "string" } },
      starter_readings: { type: "array", items: { type: "string" } },
      next_readings: { type: "array", items: { type: "string" } },
    },
    required: [
      "name",
      "explanation",
      "why_it_matters",
      "example",
      "modern_applications",
      "reading_order",
      "starter_readings",
      "next_readings",
    ],
  };
}

function conceptsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      prerequisites: { type: "array", items: conceptEntrySchema() },
      beginner_concepts: { type: "array", items: conceptEntrySchema() },
      intermediate_concepts: { type: "array", items: conceptEntrySchema() },
      advanced_concepts: { type: "array", items: conceptEntrySchema() },
      milestone_capabilities: { type: "array", items: { type: "string" } },
      bibliography_strategy: { type: "array", items: { type: "string" } },
      caution_notes: { type: "array", items: { type: "string" } },
    },
    required: [
      "overview",
      "prerequisites",
      "beginner_concepts",
      "intermediate_concepts",
      "advanced_concepts",
      "milestone_capabilities",
      "bibliography_strategy",
      "caution_notes",
    ],
  };
}

function masterySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      school_level_explanation: { type: "string" },
      formal_view: { type: "string" },
      intuition: { type: "string" },
      why_it_matters: { type: "string" },
      real_world_applications: { type: "array", items: { type: "string" } },
      prerequisites: { type: "array", items: { type: "string" } },
      key_ideas: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            explanation: { type: "string" },
            example: { type: "string" },
          },
          required: ["name", "explanation", "example"],
        },
      },
      worked_examples: {
        type: "array",
        maxItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            level: { type: "string" },
            problem: { type: "string" },
            walkthrough: { type: "array", maxItems: 4, items: { type: "string" } },
            takeaway: { type: "string" },
          },
          required: ["title", "level", "problem", "walkthrough", "takeaway"],
        },
      },
      common_misconceptions: { type: "array", items: { type: "string" } },
      mastery_checkpoints: { type: "array", items: { type: "string" } },
      study_sequence: { type: "array", items: { type: "string" } },
      next_topics: { type: "array", items: { type: "string" } },
      practice_prompts: { type: "array", items: { type: "string" } },
      caution_notes: { type: "array", items: { type: "string" } },
    },
    required: [
      "overview",
      "school_level_explanation",
      "formal_view",
      "intuition",
      "why_it_matters",
      "real_world_applications",
      "prerequisites",
      "key_ideas",
      "worked_examples",
      "common_misconceptions",
      "mastery_checkpoints",
      "study_sequence",
      "next_topics",
      "practice_prompts",
      "caution_notes",
    ],
  };
}

function uniqueList(items, maxItems = Number.POSITIVE_INFINITY) {
  const seen = new Set();
  const results = [];
  for (const item of items || []) {
    const cleaned = cleanText(item);
    const key = normalizeLabel(cleaned);
    if (!cleaned || !key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(cleaned);
    if (Number.isFinite(maxItems) && results.length >= maxItems) {
      break;
    }
  }
  return results;
}

function conceptName(item) {
  return cleanText(typeof item === "string" ? item : item?.name);
}

function buildConceptReadingOrder(name, parentLabel, level) {
  const topic = cleanText(parentLabel || "the topic");
  const stage =
    level === "prerequisite"
      ? "before the main topic"
      : level === "beginner"
        ? "as your first layer"
        : level === "intermediate"
          ? "after the basics"
          : "once the foundations are steady";

  return [
    `Start with a school-level overview of ${name} so you know what it means in plain English and why it appears in ${topic}.`,
    `Next, read a worked-example section on ${name} and copy at least one small example by hand.`,
    `Then read a standard textbook or lecture-note treatment of ${name} inside ${topic}, paying attention to definitions and theorems.`,
    `After that, read a survey, advanced chapter, or classic paper on ${name} to see how mathematicians use it beyond the first examples.`,
    `Finally, return to your notes and explain ${name} in your own words, including one example and one reason it matters in ${topic}.`,
  ];
}

function buildConceptApplications(name, parentLabel, level) {
  const topic = cleanText(parentLabel || "the topic");
  const shared = [
    `It helps you read modern mathematics, computer science, or data-oriented work more confidently because ${name} often supplies definitions, structure, or proof ideas inside ${topic}.`,
    `It supports downstream work where people need precise reasoning, careful modelling, or exact rules rather than guesswork.`,
  ];

  if (level === "prerequisite") {
    return [
      `It is part of the background needed before more advanced material in ${topic} starts to make sense.`,
      `It trains the kind of careful symbolic reading and example-based thinking used in later technical subjects.`,
      ...shared,
    ];
  }

  if (level === "beginner") {
    return [
      `It appears in introductory courses and early textbooks because it is one of the first ideas that makes ${topic} concrete.`,
      `It often shows up in computing, formal reasoning, modelling, or quantitative problem-solving whenever people need to describe a structure clearly.`,
      ...shared,
    ];
  }

  if (level === "intermediate") {
    return [
      `It helps connect textbook definitions to the way the topic is actually used in proofs, algorithms, or formal models.`,
      `It often appears in serious university-level work where the topic starts interacting with neighbouring areas of mathematics and computing.`,
      ...shared,
    ];
  }

  return [
    `It shows up in deeper theory and research-facing work where mathematicians need more refined tools than the beginner layer provides.`,
    `It can matter indirectly in verification, advanced algorithms, optimisation, formal semantics, or other technical fields that borrow structure from ${topic}.`,
    ...shared,
  ];
}

function buildConceptEntry(name, parentLabel, level) {
  const cleaned = cleanText(name);
  const topic = cleanText(parentLabel || "the selected topic");
  const levelHint =
    level === "prerequisite"
      ? "This idea should feel comfortable before you try to read the main topic."
      : level === "beginner"
        ? "This is part of the first wave of ideas a beginner should learn."
        : level === "intermediate"
          ? "This belongs to the next layer, where the topic becomes more structured and technical."
          : "This is a deeper idea that usually makes the topic feel mature and research-facing.";

  return {
    name: cleaned,
    explanation: `${cleaned} is a directly relevant idea inside ${topic}. ${levelHint} A learner should be able to say what ${cleaned} means, recognise it in simple examples, and explain how it helps organize or solve the kinds of questions that ${topic} asks.`,
    why_it_matters: `${cleaned} matters because it gives you a handle on one important part of ${topic}. If you do not understand ${cleaned}, later definitions, theorems, and examples in ${topic} will feel disconnected.`,
    example: `Look for the smallest clean example of ${cleaned} that still belongs to ${topic}, then compare it with one slightly richer example so you can see what changes and what stays the same.`,
    modern_applications: buildConceptApplications(cleaned, topic, level),
    reading_order: buildConceptReadingOrder(cleaned, topic, level),
    starter_readings: [
      `A beginner-friendly introduction to ${cleaned} within ${topic}`,
      `A worked-example textbook section on ${cleaned}`,
      `Lecture notes that define ${cleaned} and show one or two standard examples`,
    ],
    next_readings: [
      `A standard reference chapter where ${cleaned} is treated formally`,
      `A survey or advanced expository article connecting ${cleaned} to the wider topic`,
      `A classic or influential paper where ${cleaned} plays a central role`,
    ],
  };
}

function normalizeConceptEntry(item, parentLabel, level) {
  if (typeof item === "string") {
    return buildConceptEntry(item, parentLabel, level);
  }

  const name = conceptName(item);
  if (!name) {
    return null;
  }

  const fallback = buildConceptEntry(name, parentLabel, level);
  return {
    name,
    explanation: cleanText(item?.explanation) || fallback.explanation,
    why_it_matters: cleanText(item?.why_it_matters) || fallback.why_it_matters,
    example: cleanText(item?.example) || fallback.example,
    modern_applications: uniqueList(item?.modern_applications || fallback.modern_applications),
    reading_order: uniqueList(item?.reading_order || fallback.reading_order),
    starter_readings: uniqueList(item?.starter_readings || fallback.starter_readings),
    next_readings: uniqueList(item?.next_readings || fallback.next_readings),
  };
}

function uniqueConceptList(items, parentLabel, level, maxItems = Number.POSITIVE_INFINITY) {
  const seen = new Set();
  const results = [];

  for (const rawItem of items || []) {
    const normalized = normalizeConceptEntry(rawItem, parentLabel, level);
    const key = normalizeLabel(normalized?.name);
    if (!normalized || !key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(normalized);
    if (Number.isFinite(maxItems) && results.length >= maxItems) {
      break;
    }
  }

  return results;
}

function parentLabelFromDescription(description) {
  const text = cleanText(description);
  const match = text.match(/within\s+(.+?)(?:\.|$)/i);
  return cleanText(match?.[1] || "");
}

function isRelevantConceptItem(item, label, node, keywordLabels = []) {
  const cleaned = conceptName(item);
  if (!cleaned) {
    return false;
  }

  const normalized = normalizeLabel(cleaned);
  const lower = cleaned.toLowerCase();
  const bannedFragments = [
    "bibliograph",
    "dictionary",
    "handbook",
    "style",
    "history of",
    "general reference works",
    "pertaining to",
    "reference work",
    "collected works",
    "reprintings",
    "translations of classics",
    "research exposition",
    "survey articles",
    "textbook",
    "chapter",
    "journal",
    "author",
  ];
  if (bannedFragments.some((fragment) => lower.includes(fragment))) {
    return false;
  }

  const parentTokens = new Set(distinctiveTokens(label));
  const conceptTokens = distinctiveTokens(cleaned);
  const childLabels = node ? getChildren(node.code).map((child) => child.title) : [];
  const nearbyLabels = [label, ...childLabels, ...keywordLabels].map((value) => normalizeLabel(value));

  if (nearbyLabels.some((value) => value && (value === normalized || value.includes(normalized) || normalized.includes(value)))) {
    return true;
  }

  const overlap = conceptTokens.filter((token) => parentTokens.has(token)).length;
  return overlap > 0;
}

function filterRelevantConceptList(items, label, node, keywordLabels = [], level = "beginner", maxItems = Number.POSITIVE_INFINITY) {
  const topicKey = normalizeLabel(label);
  return uniqueConceptList(items, label, level, maxItems).filter((item) => {
    if (level !== "prerequisite" && normalizeLabel(item.name) === topicKey) {
      return false;
    }
    return isRelevantConceptItem(item, label, node, keywordLabels);
  });
}

function getNodeKeywordLabels(node) {
  if (!node) {
    return [];
  }
  const insight = cachedZbMathInsights.get(node.code);
  return getArray(insight?.phases)
    .flatMap((phase) => getArray(phase?.features))
    .find((feature) => feature?.key === "real_keyword_extraction")
    ?.items
    ?.map((item) => item.label) || [];
}

function applyConceptRelevanceFilter(payload, label, node) {
  const keywordLabels = getNodeKeywordLabels(node);
  return {
    ...payload,
    prerequisites: uniqueConceptList(payload.prerequisites || [], label, "prerequisite"),
    beginner_concepts: filterRelevantConceptList(payload.beginner_concepts || [], label, node, keywordLabels, "beginner"),
    intermediate_concepts: filterRelevantConceptList(payload.intermediate_concepts || [], label, node, keywordLabels, "intermediate"),
    advanced_concepts: filterRelevantConceptList(payload.advanced_concepts || [], label, node, keywordLabels, "advanced"),
    milestone_capabilities: uniqueList(payload.milestone_capabilities || [], 8),
    bibliography_strategy: uniqueList(payload.bibliography_strategy || [], 8),
    caution_notes: uniqueList(payload.caution_notes || [], 4),
  };
}

function buildFallbackConceptMap({ label, node, audience, focus }) {
  const childLabels = node ? getChildren(node.code).map((child) => child.title) : [];
  const lineageTitles = node ? node.lineage.map((item) => item.title) : [];
  const keywordLabels = getNodeKeywordLabels(node);
  const prerequisites = uniqueList([
    ...lineageTitles.slice(0, -1),
    "Basic mathematical definitions and notation",
    "Comfort with reading definitions, examples, and simple proofs",
    audience === "school" ? "Comfort with school algebra" : "Comfort with reading definitions and examples",
    audience === "school" ? "Ability to follow symbolic statements step by step" : "Basic proof-oriented mathematical maturity",
    keywordLabels[0] ? `${keywordLabels[0]} at an introductory level` : "",
    keywordLabels[1] ? `${keywordLabels[1]} at an introductory level` : "",
    focus ? `A simple introductory picture of ${focus}` : "",
  ]);

  const beginnerConcepts = filterRelevantConceptList([
    label,
    ...childLabels,
    ...keywordLabels,
    `${label} examples`,
  ], label, node, keywordLabels, "beginner");

  const intermediateConcepts = filterRelevantConceptList([
    ...childLabels.slice(1),
    ...keywordLabels,
    `${label} standard techniques`,
    focus ? `${label} through ${focus}` : "",
  ], label, node, keywordLabels, "intermediate");

  const advancedConcepts = filterRelevantConceptList([
    ...childLabels,
    ...keywordLabels,
    `${label} deeper structural results`,
  ], label, node, keywordLabels, "advanced");

  return {
    overview: `${label} can be studied as a progression from basic definitions and examples to standard techniques and then to deeper structural results.`,
    prerequisites: prerequisites.map((item) => buildConceptEntry(item, label, "prerequisite")),
    beginner_concepts: beginnerConcepts,
    intermediate_concepts: intermediateConcepts,
    advanced_concepts: advancedConcepts,
    milestone_capabilities: uniqueList([
      `Explain in plain language what ${label} studies`,
      `Recognize standard examples related to ${label}`,
      `Connect ${label} to nearby topics in the MSC hierarchy`,
      `Read introductory sources on ${label} without losing the main thread`,
    ], 8),
    bibliography_strategy: uniqueList([
      `Start with a broad introduction to ${label}`,
      "Then read a standard textbook or survey chapter",
      "After that, move to specialized references and classic papers",
    ], 6),
    caution_notes: uniqueList([
      "This fallback concept tree is heuristic and should be refined with the mastery guide and bibliography.",
      "Some listed items are topic-entry suggestions rather than a canonical progression.",
    ], 3),
  };
}

function buildFallbackMasteryGuide({ label, description, node, audience, focus }) {
  const childLabels = node ? getChildren(node.code).map((child) => child.title) : [];
  const lineageTitles = node ? node.lineage.map((item) => item.title) : [];
  const firstChildren = childLabels.slice(0, 4);
  const schoolMessage =
    audience === "school"
      ? `${label} is a part of mathematics that tries to make one kind of question precise. At school level, the best starting point is not heavy formalism, but a clear picture of what sort of patterns, objects, rules, or problems the topic is trying to understand. You should come away knowing the main question of the topic, the kind of examples that belong to it, and why mathematicians care about it.`
      : `${label} can be introduced informally before moving to precise mathematical definitions.`;
  const applications = uniqueList([
    `It sharpens the kind of structured thinking used in computer science, data systems, and algorithm design.`,
    `It helps mathematicians build precise languages for reasoning, which matters whenever people need rules that do not contradict each other.`,
    `It supports later topics that show up in cryptography, verification, optimization, and the mathematics behind computing.`,
    focus ? `Viewed through ${focus}, it also helps explain how abstract mathematical ideas get turned into usable methods.` : "",
  ], 4);

  return {
    overview: `${label} is part of ${lineageTitles[lineageTitles.length - 2] || "the broader mathematical hierarchy"} and can be learned by moving from intuition to examples to formal structure.`,
    school_level_explanation: schoolMessage,
    formal_view: `${label} is usually studied through precise definitions, carefully chosen examples, and theorems that place it within ${lineageTitles.join(" -> ") || "its surrounding MSC context"}. In formal mathematics, the point is not just to name ideas, but to prove exactly what is true and under which assumptions.`,
    intuition: `A good intuition for ${label} is to ask what kind of mathematical objects, patterns, or logical relationships the topic is trying to organize, compare, or explain. If a beginner can say what counts as a typical example and what kind of question the field asks, that is already a strong first step.`,
    why_it_matters: `${label} matters because it gives a clear language for one important part of mathematics and links to nearby topics such as ${firstChildren.join(", ") || "the surrounding MSC subfields"}. Learning it helps you read advanced mathematics without feeling that every definition is isolated.`,
    real_world_applications: applications,
    prerequisites: uniqueList([
      ...lineageTitles.slice(0, -1),
      "Comfort with mathematical definitions",
      audience === "school" ? "General school algebra and careful reading" : "Basic proof-oriented mathematical maturity",
    ], 5),
    key_ideas: uniqueList([
      label,
      ...firstChildren,
      focus ? `${label} viewed through ${focus}` : "",
    ], 4).map((item) => ({
      name: item,
      explanation: `${item} is a useful anchor point for understanding how this topic is organized.`,
      example: `Look at a simple introductory example or textbook discussion of ${item}.`,
    })),
    worked_examples: [
      {
        title: `First orientation to ${label}`,
        level: audience === "school" ? "school-friendly" : "introductory",
        problem: `Explain in simple words what ${label} is trying to study, identify one simple example, and connect it to one nearby subtopic.`,
        walkthrough: [
          `Start from the plain-language question: what kind of object, rule, or problem does ${label} study?`,
          `Choose one simple example or toy case related to ${label}, even if it is much simpler than the full research version.`,
          `Name one nearby topic from the MSC hierarchy and explain how it is connected.`,
          "Summarize how the simple beginner picture grows into a formal mathematical theory.",
        ],
        takeaway: `${label} becomes more manageable once you connect its formal name to examples and neighboring topics.`,
      },
    ],
    common_misconceptions: uniqueList([
      `Thinking ${label} is only a list of definitions instead of a connected body of ideas`,
      `Expecting school-level intuition to capture the full formal depth of ${label}`,
      "Confusing the broader area with one narrow subtopic",
    ], 4),
    mastery_checkpoints: uniqueList([
      `State in plain English what ${label} is about`,
      `Recognize at least one example and one non-example related to ${label}`,
      `Place ${label} in the MSC hierarchy`,
      `Know which textbook or survey to read next`,
    ], 4),
    study_sequence: uniqueList([
      `Start with intuition for ${label}`,
      "Read definitions and basic examples",
      "Study one standard worked example",
      "Read a survey or introductory chapter",
      "Then move into a specialized subtopic",
    ], 5),
    next_topics: uniqueList([
      ...firstChildren,
      lineageTitles[lineageTitles.length - 2] || "",
    ], 4),
    practice_prompts: uniqueList([
      `Explain ${label} to a student one level below your current background`,
      `Write down three examples related to ${label}`,
      `Compare ${label} with a nearby MSC subtopic`,
      "Find one survey and one textbook chapter on this topic",
    ], 4),
    caution_notes: uniqueList([
      "This fallback mastery guide is deterministic and less rich than the model-generated version.",
      "Use the bibliography and concept tree to deepen or verify the guide.",
    ], 3),
  };
}

async function buildQueries({ scheme, id, label, focus, parent_label, parent_code, description }) {
  const candidates = [label];
  if (scheme === "msc") {
    candidates.push(`${id} ${label}`);
    candidates.push(`${label} mathematics`);
    try {
      const insight = await lookupControlledVocabulary(id);
      const keywordHints = getArray(insight?.phases)
        .flatMap((phase) => getArray(phase?.features))
        .find((feature) => feature?.key === "real_keyword_extraction")
        ?.items || [];
      for (const hint of keywordHints.slice(0, 3)) {
        candidates.push(`${label} ${hint.label}`);
      }
    } catch {
      // Fall back to the base MSC queries when zbMATH is unavailable.
    }
  }
  if (scheme === "concept") {
    const parentLabel = cleanText(parent_label || parentLabelFromDescription(description));
    const parentCode = cleanText(parent_code);
    if (parentLabel) {
      candidates.push(`${label} ${parentLabel}`);
      candidates.push(`${parentLabel} ${label} mathematics`);
    }
    if (parentCode && parentLabel) {
      candidates.push(`${parentCode} ${parentLabel} ${label}`);
    }
  }
  if (focus) {
    candidates.push(`${label} ${focus}`);
  }

  const seen = new Set();
  const queries = [];
  for (const candidate of candidates) {
    const normalized = cleanText(candidate);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    queries.push(normalized);
  }
  return queries.slice(0, 5);
}

function titleKey(title, year) {
  return `${normalizeLabel(title).replace(/\s+/g, "-")}-${year || "na"}`;
}

function normalizeDoi(value) {
  return cleanText(value).replace(/^https?:\/\/doi\.org\//i, "").trim();
}

function safeInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

function scoreCandidate(candidate, label, context = "") {
  const targetTokens = new Set(
    normalizeLabel([label, context].filter(Boolean).join(" ")).split(" ").filter((item) => item.length > 2),
  );
  const titleTokens = new Set(normalizeLabel(candidate.title).split(" ").filter((item) => item.length > 2));
  let overlap = 0;
  for (const token of targetTokens) {
    if (titleTokens.has(token)) {
      overlap += 1;
    }
  }
  const citationScore = Math.min(Math.log1p(candidate.citation_count || 0) / 6, 1.5);
  const overlapScore = overlap / Math.max(targetTokens.size, 1);
  const sourceBonus = candidate.source_links.length > 1 ? 0.35 : 0;
  const typeBonus = /book/i.test(candidate.work_type || "") ? 0.25 : 0;
  return overlapScore * 2 + citationScore + sourceBonus + typeBonus;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MSC-Math-Atlas/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

async function fetchCrossref(query, label, context = "") {
  const params = new URLSearchParams({
    "query.bibliographic": query,
    rows: "10",
    select: "DOI,URL,title,author,issued,container-title,type,is-referenced-by-count",
  });
  if (process.env.CROSSREF_MAILTO) {
    params.set("mailto", process.env.CROSSREF_MAILTO);
  }

  const payload = await fetchJson(`https://api.crossref.org/works?${params.toString()}`);
  const items = payload?.message?.items || [];
  return items.slice(0, 10).map((item, index) => {
    const title = cleanText(Array.isArray(item.title) ? item.title[0] : item.title) || "Untitled work";
    const authors = Array.isArray(item.author)
      ? item.author.map((author) => cleanText(`${author.given || ""} ${author.family || ""}`)).filter(Boolean)
      : [];
    const dateParts = item.issued?.["date-parts"];
    const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? safeInt(dateParts[0][0]) : null;
    const doi = normalizeDoi(item.DOI);
    const candidate = {
      candidate_id: `crossref-${index}-${titleKey(title, year)}`,
      title,
      authors,
      year,
      venue: cleanText(Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"]),
      work_type: cleanText(item.type),
      doi,
      url: typeof item.URL === "string" ? item.URL : "",
      citation_count: safeInt(item["is-referenced-by-count"]),
      source_links: [
        {
          source: "crossref",
          label: "Crossref record",
          url: doi ? `https://doi.org/${doi}` : item.URL,
        },
      ].filter((link) => link.url),
    };
    candidate.relevance_score = scoreCandidate(candidate, label, context);
    return candidate;
  });
}

async function fetchOpenAlex(query, label, context = "") {
  const params = new URLSearchParams({
    search: query,
    "per-page": "10",
    sort: "cited_by_count:desc",
  });
  if (process.env.OPENALEX_EMAIL) {
    params.set("mailto", process.env.OPENALEX_EMAIL);
  }

  const payload = await fetchJson(`https://api.openalex.org/works?${params.toString()}`);
  const items = payload?.results || [];
  return items.slice(0, 10).map((item, index) => {
    const source = item.primary_location?.source || {};
    const candidate = {
      candidate_id: `openalex-${index}-${titleKey(item.display_name, item.publication_year)}`,
      title: cleanText(item.display_name) || "Untitled work",
      authors: Array.isArray(item.authorships)
        ? item.authorships.map((authorship) => cleanText(authorship?.author?.display_name)).filter(Boolean)
        : [],
      year: safeInt(item.publication_year),
      venue: cleanText(source.display_name),
      work_type: cleanText(item.type),
      doi: normalizeDoi(item.doi),
      url: cleanText(item.primary_location?.landing_page_url),
      citation_count: safeInt(item.cited_by_count),
      source_links: [
        {
          source: "openalex",
          label: "OpenAlex record",
          url: cleanText(item.id),
        },
      ].filter((link) => link.url),
    };
    candidate.relevance_score = scoreCandidate(candidate, label, context);
    return candidate;
  });
}

async function retrieveCandidates({ scheme, id, label, focus, parent_label, parent_code, description }) {
  const queries = await buildQueries({ scheme, id, label, focus, parent_label, parent_code, description });
  const context = scheme === "concept" ? cleanText([parent_label || parentLabelFromDescription(description), parent_code].filter(Boolean).join(" ")) : "";
  const merged = new Map();

  for (const query of queries) {
    const candidates = [
      ...(await fetchCrossref(query, label, context)),
      ...(await fetchOpenAlex(query, label, context)),
    ];

    for (const candidate of candidates) {
      const key = candidate.doi || titleKey(candidate.title, candidate.year);
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.source_links = [
          ...existing.source_links,
          ...candidate.source_links.filter(
            (link) => !existing.source_links.some((existingLink) => existingLink.url === link.url),
          ),
        ];
        existing.citation_count = Math.max(existing.citation_count || 0, candidate.citation_count || 0);
        existing.relevance_score = Math.max(existing.relevance_score, candidate.relevance_score);
        if (!existing.url) {
          existing.url = candidate.url;
        }
        if (!existing.venue) {
          existing.venue = candidate.venue;
        }
        if (!existing.work_type) {
          existing.work_type = candidate.work_type;
        }
      } else {
        merged.set(key, candidate);
      }
    }
  }

  return [...merged.values()].sort((left, right) => right.relevance_score - left.relevance_score).slice(0, 20);
}

function candidateToEntry(candidate, rationale = "") {
  const confidence =
    candidate.doi && candidate.source_links.length > 1
      ? "high"
      : candidate.doi || (candidate.citation_count || 0) >= 40
        ? "medium"
        : "low";

  const beginnerRationale = rationale
    || `This is worth reading because it is one of the stronger grounded references for ${candidate.title}. Start with the title, authors, and year, then use it to understand how mathematicians usually introduce or develop the topic.`;

  return {
    title: candidate.title,
    authors: candidate.authors,
    year: candidate.year,
    venue: candidate.venue,
    work_type: candidate.work_type,
    doi: candidate.doi,
    url: candidate.url,
    citation_count: candidate.citation_count,
    rationale: beginnerRationale,
    confidence,
    source_links: candidate.source_links,
  };
}

function heuristicSections(candidates, maxEntries) {
  const selected = candidates.slice(0, maxEntries);
  const buckets = [
    {
      key: "seminal_works",
      label: "Seminal works to start with",
      description: "Older anchor works, famous books, and strong classics that help a beginner understand where the topic comes from.",
      predicate: (candidate) =>
        (candidate.citation_count || 0) >= 80
        || /book/i.test(candidate.work_type || "")
        || safeInt(candidate.year) && candidate.year <= 1995,
    },
    {
      key: "reference_texts",
      label: "Reference texts and standard introductions",
      description: "Books and broad references that help a beginner get oriented before reading more specialized papers.",
      predicate: (candidate) =>
        /book/i.test(candidate.work_type || "") ||
        /(introduction|textbook|handbook|treatise)/i.test(candidate.title),
    },
    {
      key: "foundational_works",
      label: "Foundational works",
      description: "Important works that build the core mathematical structure of the area.",
      predicate: (candidate) => (candidate.citation_count || 0) >= 30,
    },
    {
      key: "survey_overviews",
      label: "Surveys and overviews",
      description: "Papers or books that explain the field in a more guided and readable way.",
      predicate: (candidate) => /(survey|overview|guide|handbook)/i.test(candidate.title),
    },
  ];

  const used = new Set();
  const sections = [];
  for (const bucket of buckets) {
    const entries = [];
    for (const candidate of selected) {
      if (used.has(candidate.candidate_id) || !bucket.predicate(candidate)) {
        continue;
      }
      entries.push(candidateToEntry(candidate));
      used.add(candidate.candidate_id);
      if (entries.length >= Math.max(1, Math.floor(maxEntries / 4))) {
        break;
      }
    }
    if (entries.length) {
      sections.push({
        key: bucket.key,
        label: bucket.label,
        description: bucket.description,
        entries,
      });
    }
  }

  const remainder = selected.filter((candidate) => !used.has(candidate.candidate_id));
  if (remainder.length) {
    sections.push({
      key: "additional_relevant_works",
      label: "Additional relevant works",
      description: "Grounded candidates that still fit the topic but were not more specifically classified.",
      entries: remainder.map((candidate) => candidateToEntry(candidate)),
    });
  }

  return sections;
}

async function generateGroundedBibliography({ scheme, id, label, description, focus, notes, audience, maxEntries, parent_label, parent_code }) {
  const candidates = await retrieveCandidates({ scheme, id, label, focus, parent_label, parent_code, description });
  if (!candidates.length) {
    throw new Error("No grounded bibliography candidates were found from Crossref or OpenAlex.");
  }

  const queries = await buildQueries({ scheme, id, label, focus, parent_label, parent_code, description });
  const searchGuidance = queries.map((query) => `Crossref/OpenAlex query: ${query}`);
  let sections = heuristicSections(candidates, maxEntries);
  let overview =
    `Grounded bibliography candidates for ${label}, assembled from Crossref and OpenAlex. ` +
    "These entries are filtered conservatively to reduce fabricated citations.";
  const caveats = [];
  let modelName = "grounded-heuristic";

  if (process.env.OPENAI_API_KEY) {
    try {
      const payload = await callOpenAI({
        prompt: [
          "You are curating a grounded mathematics bibliography.",
          "The user is a complete beginner, so all explanations must be in simple plain English.",
          "Put seminal and foundational works first whenever the evidence supports that ordering.",
          "For every selected work, the rationale must explain in school-level language why a beginner should care about it and what role it plays in learning the topic.",
          scheme === "concept"
            ? "Be specific to the concept itself, not just the broader parent field. If a work is only broadly related to the parent topic but not to the concept, do not use it."
            : "Stay tightly focused on the selected mathematical topic.",
          `Scheme: ${scheme}`,
          `Identifier: ${id}`,
          `Label: ${label}`,
          `Description: ${description || "No description available."}`,
          `Parent topic: ${parent_label || "Not provided"}`,
          `Audience: ${audience || "beginner"}`,
          `Focus: ${focus || "No special focus."}`,
          `User notes: ${notes || "No additional notes."}`,
          `Maximum total entries: ${maxEntries}`,
          "Use only the provided candidate ids. Do not invent titles, authors, years, or citations.",
          `Candidate works: ${JSON.stringify(
            candidates.slice(0, 18).map((candidate) => ({
              id: candidate.candidate_id,
              title: candidate.title,
              authors: candidate.authors,
              year: candidate.year,
              venue: candidate.venue,
              work_type: candidate.work_type,
              doi: candidate.doi,
              url: candidate.url,
              citation_count: candidate.citation_count,
            })),
          )}`,
        ].join("\n"),
        schemaName: "msc_grounded_bibliography",
        schema: bibliographySchema(),
      });

      const candidateMap = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
      const used = new Set();
      const curatedSections = [];

      for (const section of payload.sections || []) {
        const entries = [];
        for (const item of section.entries || []) {
          const candidate = candidateMap.get(item.candidate_id);
          if (!candidate || used.has(candidate.candidate_id)) {
            continue;
          }
          used.add(candidate.candidate_id);
          entries.push(candidateToEntry(candidate, item.rationale));
          if (entries.length >= maxEntries) {
            break;
          }
        }
        if (entries.length) {
          curatedSections.push({
            key: section.key,
            label: section.label,
            description: section.description,
            entries,
          });
        }
      }

      if (curatedSections.length) {
        sections = curatedSections;
      }
      overview = payload.overview || overview;
      for (const caveat of payload.caveats || []) {
        caveats.push(caveat);
      }
      modelName = process.env.OPENAI_MODEL || "gpt-5-mini";
    } catch (error) {
      caveats.push(error.message);
    }
  } else {
    caveats.push("OPENAI_API_KEY is not configured, so bibliography grouping is heuristic even though the citations are grounded.");
  }

  return {
    target_scheme: scheme,
    target_id: id,
    target_label: label,
    description: description || "",
    audience: audience || "graduate",
    focus: focus || "",
    overview,
    sections,
    search_guidance: searchGuidance,
    caveats,
    grounded: true,
    generated_at: new Date().toISOString(),
    model: modelName,
  };
}

async function generateConceptMap({ scheme, id, label, description, focus, audience }) {
  const node = scheme === "msc" ? getNodeDetail(id) : null;
  const childLabels = node ? getChildren(node.code).map((child) => child.title) : [];
  const lineage = node ? node.lineage.map((item) => `${item.code} ${item.title}`) : [];
  const keywordLabels = getNodeKeywordLabels(node);
  try {
    const payload = await callOpenAI({
      prompt: [
        "You are building a conservative learning map for mathematics.",
        `Scheme: ${scheme}`,
        `Identifier: ${id}`,
        `Label: ${label}`,
        `Description: ${description || "No further description was supplied."}`,
        `Audience: ${audience || "graduate"}`,
        `Focus: ${focus || "No special focus."}`,
        `Lineage: ${lineage.join(", ") || "Not available"}`,
        `Official child labels: ${childLabels.slice(0, 12).join(", ") || "Not available"}`,
        `Relevant zbMATH keyword hints: ${keywordLabels.slice(0, 10).join(", ") || "Not available"}`,
        "For every concept entry, answer these questions in plain English:",
        "1. What is this concept about?",
        "2. Why does it matter inside the topic?",
        "3. What is a simple example?",
        "4. Where does it matter in the modern world, or in modern mathematics, computing, science, engineering, economics, or logic?",
        "5. What should the learner read first, second, third, and fourth to master it?",
        "Stay with canonical, widely recognized concepts only.",
        "Use only concepts that are directly relevant to the selected topic.",
        "Exclude neighboring fields, author names, journal names, historical labels, broad umbrella labels, and application areas unless they are core concepts of the topic itself.",
        "A beginner concept should be something a learner should actually study first, not just a loosely associated phrase.",
        "Return every directly relevant concept that a serious beginner-to-advanced learner would need in order to orient themselves. Do not cap the count artificially.",
        "Do not stop after 3 or 4 items if the topic clearly needs more. Include all genuinely relevant prerequisites and concepts that a strong learner should know.",
        "For every concept, provide a detailed school-level explanation, a short why-it-matters note, one concrete example, modern-world or downstream applications, and an ordered reading plan.",
        "The reading plan should tell the learner what kind of source to read first, second, third, and fourth to master that concept.",
        "All explanations must be plain-English first, with jargon explained immediately.",
        "Do not invent new terminology, schools, or subfields.",
        "This learning map is pedagogical and separate from the official MSC hierarchy.",
      ].join("\n"),
      schemaName: "msc_learning_map",
      schema: conceptsSchema(),
    });

    return {
      target_scheme: scheme,
      target_id: id,
      target_label: label,
      generated_at: new Date().toISOString(),
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      ...applyConceptRelevanceFilter(payload, label, node),
    };
  } catch (error) {
    return {
      target_scheme: scheme,
      target_id: id,
      target_label: label,
      generated_at: new Date().toISOString(),
      model: "fallback-concept-map",
      ...applyConceptRelevanceFilter(buildFallbackConceptMap({ label, node, audience, focus }), label, node),
    };
  }
}

async function generateMasteryGuide({ scheme, id, label, description, focus, audience }) {
  const node = scheme === "msc" ? getNodeDetail(id) : null;
  const childLabels = node ? getChildren(node.code).map((child) => child.title) : [];
  const lineage = node ? node.lineage.map((item) => `${item.code} ${item.title}`) : [];
  try {
    const payload = await callOpenAI({
      prompt: [
        "You are building a mathematics mastery guide for serious learners.",
        "Be detailed, conservative, and pedagogically clear.",
        "Use plain English first, then more formal language where appropriate.",
        "Every explanation must stay within canonical mathematics and avoid invented terminology.",
        "Write for a complete beginner first. Use school-level language wherever possible and explain jargon immediately.",
        "The school-level explanation must clearly answer: what is this topic about, what kinds of things does it study, and what kinds of questions does it ask.",
        "The why-it-matters section must include real-world application examples or realistic downstream uses of the ideas.",
        `Scheme: ${scheme}`,
        `Identifier: ${id}`,
        `Label: ${label}`,
        `Description: ${description || "No further description was supplied."}`,
        `Audience: ${audience || "undergraduate"}`,
        `Focus: ${focus || "No special focus."}`,
        `Lineage: ${lineage.join(", ") || "Not available"}`,
        `Official child labels: ${childLabels.slice(0, 12).join(", ") || "Not available"}`,
        "The school-level explanation should assume a bright student with general school mathematics but no specialist background.",
        "Worked examples must be conceptually faithful and should explain steps in plain language.",
        "If the topic is too advanced for school-level mastery, say so plainly and explain the nearest accessible intuition instead of pretending it is elementary.",
        "Return 3 to 4 real-world applications or concrete downstream uses in plain language.",
        "The study sequence should move from intuition to formalism to examples to deeper theory.",
        "Caution notes should clearly mark simplifications, edge cases, or places where intuition can mislead.",
        "Keep the output concise enough to return quickly in a serverless environment.",
        "Return at most 5 prerequisites, 4 key ideas, 1 worked example, 4 misconceptions, 4 checkpoints, 5 study-sequence steps, 4 next topics, and 4 practice prompts.",
        "Each worked example should use at most 4 walkthrough steps.",
      ].join("\n"),
      schemaName: "msc_mastery_guide",
      schema: masterySchema(),
      maxOutputTokens: 1200,
      reasoningEffort: "low",
    });

    return {
      target_scheme: scheme,
      target_id: id,
      target_label: label,
      generated_at: new Date().toISOString(),
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      ...payload,
    };
  } catch (error) {
    return {
      target_scheme: scheme,
      target_id: id,
      target_label: label,
      generated_at: new Date().toISOString(),
      model: "fallback-mastery-guide",
      ...buildFallbackMasteryGuide({ label, description, node, audience, focus }),
    };
  }
}

function handleHealthRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const catalog = loadCatalog();
  sendJson(res, 200, {
    ok: true,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    officialRowCount: catalog.officialRowCount,
    levelCounts: catalog.levelCounts,
  });
}

module.exports = {
  generateConceptMap,
  generateGroundedBibliography,
  generateMasteryGuide,
  getChildren,
  getNodeDetail,
  getRootNodes,
  handleHealthRequest,
  lookupControlledVocabulary,
  readJsonBody,
  searchCatalog,
  sendJson,
};
