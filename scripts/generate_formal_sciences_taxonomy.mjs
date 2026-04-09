import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const sourcePdfPath = path.join(workspaceRoot, "sources", "msc2020.pdf");
const outputDir = path.join(workspaceRoot, "outputs");
const sourceUrl = "https://msc2020.org/MSC_2020.pdf";

const branchBySection = new Map([
  ["00", "Foundations and methodology"],
  ["01", "History and biography of mathematics"],
  ["03", "Logic and foundations"],
  ["05", "Mathematics"],
  ["06", "Mathematics"],
  ["08", "Mathematics"],
  ["11", "Mathematics"],
  ["12", "Mathematics"],
  ["13", "Mathematics"],
  ["14", "Mathematics"],
  ["15", "Mathematics"],
  ["16", "Mathematics"],
  ["17", "Mathematics"],
  ["18", "Mathematics"],
  ["19", "Mathematics"],
  ["20", "Mathematics"],
  ["22", "Mathematics"],
  ["26", "Mathematics"],
  ["28", "Mathematics"],
  ["30", "Mathematics"],
  ["31", "Mathematics"],
  ["32", "Mathematics"],
  ["33", "Mathematics"],
  ["34", "Mathematics"],
  ["35", "Mathematics"],
  ["37", "Mathematics"],
  ["39", "Mathematics"],
  ["40", "Mathematics"],
  ["41", "Mathematics"],
  ["42", "Mathematics"],
  ["43", "Mathematics"],
  ["44", "Mathematics"],
  ["45", "Mathematics"],
  ["46", "Mathematics"],
  ["47", "Mathematics"],
  ["49", "Mathematics"],
  ["51", "Mathematics"],
  ["52", "Mathematics"],
  ["53", "Mathematics"],
  ["54", "Mathematics"],
  ["55", "Mathematics"],
  ["57", "Mathematics"],
  ["58", "Mathematics"],
  ["60", "Probability"],
  ["62", "Statistics"],
  ["65", "Numerical analysis and scientific computing"],
  ["68", "Computer science"],
  ["70", "Applied mathematical physics"],
  ["74", "Applied mathematical physics"],
  ["76", "Applied mathematical physics"],
  ["78", "Applied mathematical physics"],
  ["80", "Applied mathematical physics"],
  ["81", "Applied mathematical physics"],
  ["82", "Applied mathematical physics"],
  ["83", "Applied mathematical physics"],
  ["85", "Applied mathematical physics"],
  ["86", "Applied mathematical physics"],
  ["90", "Operations research and optimization"],
  ["91", "Game theory and formal social science"],
  ["92", "Mathematical life and natural sciences"],
  ["93", "Systems theory and control"],
  ["94", "Information and communication theory"],
  ["97", "Mathematics education"],
]);

const scopeBySection = new Map([
  ["00", "adjacent"],
  ["01", "peripheral"],
  ["03", "core"],
  ["05", "core"],
  ["06", "core"],
  ["08", "core"],
  ["11", "core"],
  ["12", "core"],
  ["13", "core"],
  ["14", "core"],
  ["15", "core"],
  ["16", "core"],
  ["17", "core"],
  ["18", "core"],
  ["19", "core"],
  ["20", "core"],
  ["22", "core"],
  ["26", "core"],
  ["28", "core"],
  ["30", "core"],
  ["31", "core"],
  ["32", "core"],
  ["33", "core"],
  ["34", "core"],
  ["35", "core"],
  ["37", "core"],
  ["39", "core"],
  ["40", "core"],
  ["41", "core"],
  ["42", "core"],
  ["43", "core"],
  ["44", "core"],
  ["45", "core"],
  ["46", "core"],
  ["47", "core"],
  ["49", "core"],
  ["51", "core"],
  ["52", "core"],
  ["53", "core"],
  ["54", "core"],
  ["55", "core"],
  ["57", "core"],
  ["58", "core"],
  ["60", "core"],
  ["62", "core"],
  ["65", "core"],
  ["68", "core"],
  ["70", "peripheral"],
  ["74", "peripheral"],
  ["76", "peripheral"],
  ["78", "peripheral"],
  ["80", "peripheral"],
  ["81", "peripheral"],
  ["82", "peripheral"],
  ["83", "peripheral"],
  ["85", "peripheral"],
  ["86", "peripheral"],
  ["90", "adjacent"],
  ["91", "adjacent"],
  ["92", "peripheral"],
  ["93", "adjacent"],
  ["94", "adjacent"],
  ["97", "peripheral"],
]);

function repairMojibake(text) {
  let repaired = text;

  if (/[ÃÂâÎ]/.test(repaired)) {
    try {
      const decoded = Buffer.from(repaired, "latin1").toString("utf8");
      if (decoded && decoded.includes("\uFFFD") === false) {
        repaired = decoded;
      }
    } catch {
      // Keep the original text if the heuristic decode fails.
    }
  }

  return repaired
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/Â/g, "");
}

function normalizeWhitespace(text) {
  return repairMojibake(text).replace(/\s+/g, " ").trim();
}

function appendContinuation(base, extra) {
  const next = normalizeWhitespace(extra);
  if (!base) {
    return next;
  }
  if (base.endsWith("-")) {
    return `${base.slice(0, -1)}${next}`;
  }
  return `${base} ${next}`.replace(/\s+/g, " ").trim();
}

function classifyCode(code) {
  if (/^\d\d-XX$/.test(code)) {
    return "field";
  }
  if (/^\d\d-\d\d$/.test(code) || /^\d\d[A-Z]xx$/.test(code)) {
    return "subfield";
  }
  if (/^\d\d[A-Z]\d\d$/.test(code)) {
    return "sub_subfield";
  }
  return "unknown";
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","));
  return [header, ...body].join("\n");
}

function stripCrossReferences(text) {
  return normalizeWhitespace(
    text
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'"),
  );
}

function asciiSearchText(text) {
  const greekMap = new Map([
    ["α", "alpha"],
    ["β", "beta"],
    ["γ", "gamma"],
    ["δ", "delta"],
    ["ε", "epsilon"],
    ["ζ", "zeta"],
    ["η", "eta"],
    ["θ", "theta"],
    ["ι", "iota"],
    ["κ", "kappa"],
    ["λ", "lambda"],
    ["μ", "mu"],
    ["ν", "nu"],
    ["ξ", "xi"],
    ["π", "pi"],
    ["ρ", "rho"],
    ["σ", "sigma"],
    ["τ", "tau"],
    ["φ", "phi"],
    ["χ", "chi"],
    ["ψ", "psi"],
    ["ω", "omega"],
    ["Γ", "Gamma"],
    ["Δ", "Delta"],
    ["Θ", "Theta"],
    ["Λ", "Lambda"],
    ["Ξ", "Xi"],
    ["Π", "Pi"],
    ["Σ", "Sigma"],
    ["Φ", "Phi"],
    ["Ψ", "Psi"],
    ["Ω", "Omega"],
    ["∞", "infinity"],
  ]);

  let value = stripCrossReferences(text);
  for (const [symbol, replacement] of greekMap) {
    value = value.split(symbol).join(replacement);
  }

  value = value
    .replace(/[´`˘¨ˆˇ¸˙˚¯]/g, "")
    .replace(/ı/g, "i")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/ß/g, "ss")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\x20-\x7E]/g, " ");

  return normalizeWhitespace(value);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => normalizeWhitespace(value)))];
}

function buildScholarQuery(row) {
  const mostSpecific = row.sub_subfield || row.subfield || row.field;
  return uniqueValues([
    stripCrossReferences(mostSpecific),
    stripCrossReferences(row.subfield),
    stripCrossReferences(row.field),
    row.source_code,
    "MSC2020",
  ]).join(" ");
}

function buildKeywords(row) {
  const mostSpecific = row.sub_subfield || row.subfield || row.field;
  return uniqueValues([
    stripCrossReferences(mostSpecific),
    stripCrossReferences(row.subfield),
    stripCrossReferences(row.field),
    row.formal_branch,
    row.source_code,
    "MSC2020",
  ]).join("; ");
}

function parseItemsFromText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const startIndex = lines.findIndex((line) => line.startsWith("00-XX "));
  if (startIndex === -1) {
    throw new Error("Could not locate the beginning of the MSC2020 hierarchy.");
  }

  const items = [];
  let currentItem = null;

  const pushCurrent = () => {
    if (!currentItem) {
      return;
    }
    currentItem.title = normalizeWhitespace(currentItem.title);
    items.push(currentItem);
    currentItem = null;
  };

  for (const line of lines.slice(startIndex)) {
    if (!line || /^\d+$/.test(line) || /^-- \d+ of \d+ --$/.test(line)) {
      continue;
    }

    const itemMatch = line.match(/^(\d\d(?:-XX|-\d\d|[A-Z](?:xx|\d\d)))\s+(.+)$/);
    if (itemMatch) {
      pushCurrent();
      const [, code, title] = itemMatch;
      currentItem = {
        code,
        title,
        sectionCode: code.slice(0, 2),
        level: classifyCode(code),
      };
      continue;
    }

    if (currentItem) {
      currentItem.title = appendContinuation(currentItem.title, line);
    }
  }

  pushCurrent();
  return items;
}

function buildRows(items) {
  const fieldMap = new Map();
  const familyMap = new Map();

  for (const item of items) {
    if (item.level === "field") {
      fieldMap.set(item.code, item.title);
      continue;
    }
    if (/^\d\d[A-Z]xx$/.test(item.code)) {
      familyMap.set(item.code, item.title);
    }
  }

  return items.map((item) => {
    const sectionCode = `${item.sectionCode}-XX`;
    const fieldTitle = fieldMap.get(sectionCode) ?? "";
    const branch = branchBySection.get(item.sectionCode) ?? "Unmapped";
    const formalScope = scopeBySection.get(item.sectionCode) ?? "peripheral";

    let subfield = "";
    let subSubfield = "";
    let parentCode = "";

    if (item.level === "field") {
      const row = {
        formal_branch: branch,
        formal_scope: formalScope,
        field: item.title,
        subfield,
        sub_subfield: subSubfield,
        node_level: item.level,
        section_code: item.code,
        parent_code: parentCode,
        source_system: "MSC2020",
        source_tag: `MSC2020:${item.code}`,
        source_code: item.code,
        source_title: item.title,
        source_url: sourceUrl,
      };
      row.keyword = stripCrossReferences(row.field);
      row.keyword_path = row.field;
      row.keywords = buildKeywords(row);
      row.scholar_query = buildScholarQuery(row);
      row.google_scholar_url = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query)}`;
      row.keyword_ascii = asciiSearchText(row.keyword);
      row.keywords_ascii = asciiSearchText(row.keywords);
      row.scholar_query_ascii = asciiSearchText(row.scholar_query);
      row.google_scholar_url_ascii = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query_ascii)}`;
      return row;
    }

    if (/^\d\d-\d\d$/.test(item.code) || /^\d\d[A-Z]xx$/.test(item.code)) {
      subfield = item.title;
      parentCode = sectionCode;
      const row = {
        formal_branch: branch,
        formal_scope: formalScope,
        field: fieldTitle,
        subfield,
        sub_subfield: subSubfield,
        node_level: item.level,
        section_code: sectionCode,
        parent_code: parentCode,
        source_system: "MSC2020",
        source_tag: `MSC2020:${item.code}`,
        source_code: item.code,
        source_title: item.title,
        source_url: sourceUrl,
      };
      row.keyword = stripCrossReferences(row.subfield || row.field);
      row.keyword_path = [row.field, row.subfield].filter(Boolean).join(" > ");
      row.keywords = buildKeywords(row);
      row.scholar_query = buildScholarQuery(row);
      row.google_scholar_url = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query)}`;
      row.keyword_ascii = asciiSearchText(row.keyword);
      row.keywords_ascii = asciiSearchText(row.keywords);
      row.scholar_query_ascii = asciiSearchText(row.scholar_query);
      row.google_scholar_url_ascii = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query_ascii)}`;
      return row;
    }

    const familyCode = `${item.code.slice(0, 3)}xx`;
    subfield = familyMap.get(familyCode) ?? "";
    subSubfield = item.title;
    parentCode = familyCode;

    const row = {
      formal_branch: branch,
      formal_scope: formalScope,
      field: fieldTitle,
      subfield,
      sub_subfield: subSubfield,
      node_level: item.level,
      section_code: sectionCode,
      parent_code: parentCode,
      source_system: "MSC2020",
      source_tag: `MSC2020:${item.code}`,
      source_code: item.code,
      source_title: item.title,
      source_url: sourceUrl,
    };
    row.keyword = stripCrossReferences(row.sub_subfield || row.subfield || row.field);
    row.keyword_path = [row.field, row.subfield, row.sub_subfield].filter(Boolean).join(" > ");
    row.keywords = buildKeywords(row);
    row.scholar_query = buildScholarQuery(row);
    row.google_scholar_url = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query)}`;
    row.keyword_ascii = asciiSearchText(row.keyword);
    row.keywords_ascii = asciiSearchText(row.keywords);
    row.scholar_query_ascii = asciiSearchText(row.scholar_query);
    row.google_scholar_url_ascii = `https://scholar.google.com/scholar?q=${encodeURIComponent(row.scholar_query_ascii)}`;
    return row;
  });
}

function toKeywordRows(rows) {
  return rows.map((row) => ({
    keyword: row.keyword,
    keyword_ascii: row.keyword_ascii,
    keyword_path: row.keyword_path,
    keywords: row.keywords,
    keywords_ascii: row.keywords_ascii,
    scholar_query: row.scholar_query,
    scholar_query_ascii: row.scholar_query_ascii,
    google_scholar_url: row.google_scholar_url,
    google_scholar_url_ascii: row.google_scholar_url_ascii,
    formal_branch: row.formal_branch,
    formal_scope: row.formal_scope,
    field: row.field,
    subfield: row.subfield,
    sub_subfield: row.sub_subfield,
    node_level: row.node_level,
    source_tag: row.source_tag,
    source_code: row.source_code,
    source_title: row.source_title,
  }));
}

function buildUniqueKeywordRows(rows) {
  const keywordMap = new Map();

  for (const row of rows) {
    const key = normalizeWhitespace(row.keyword).toLowerCase();
    if (!key) {
      continue;
    }

    const existing = keywordMap.get(key) ?? {
      keyword: row.keyword,
      keyword_ascii: row.keyword_ascii,
      scholar_query: row.keyword,
      scholar_query_ascii: row.keyword_ascii,
      google_scholar_url: `https://scholar.google.com/scholar?q=${encodeURIComponent(row.keyword)}`,
      google_scholar_url_ascii: `https://scholar.google.com/scholar?q=${encodeURIComponent(row.keyword_ascii)}`,
      formal_branches: new Set(),
      formal_scopes: new Set(),
      fields: new Set(),
      source_tags: new Set(),
      source_codes: new Set(),
      source_titles: new Set(),
      occurrences: 0,
    };

    existing.formal_branches.add(row.formal_branch);
    existing.formal_scopes.add(row.formal_scope);
    if (row.field) {
      existing.fields.add(row.field);
    }
    existing.source_tags.add(row.source_tag);
    existing.source_codes.add(row.source_code);
    existing.source_titles.add(row.source_title);
    existing.occurrences += 1;

    keywordMap.set(key, existing);
  }

  return [...keywordMap.values()]
    .map((entry) => ({
      keyword: entry.keyword,
      keyword_ascii: entry.keyword_ascii,
      scholar_query: entry.scholar_query,
      scholar_query_ascii: entry.scholar_query_ascii,
      google_scholar_url: entry.google_scholar_url,
      google_scholar_url_ascii: entry.google_scholar_url_ascii,
      occurrences: entry.occurrences,
      formal_branches: [...entry.formal_branches].sort().join("; "),
      formal_scopes: [...entry.formal_scopes].sort().join("; "),
      fields: [...entry.fields].sort().join("; "),
      source_tags: [...entry.source_tags].sort().join("; "),
      source_codes: [...entry.source_codes].sort().join("; "),
      source_titles: [...entry.source_titles].sort().join("; "),
    }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

async function main() {
  const pdfBuffer = await readFile(sourcePdfPath);
  const parser = new PDFParse({ data: pdfBuffer });
  const result = await parser.getText();
  await parser.destroy();

  const items = parseItemsFromText(result.text);
  const rows = buildRows(items);

  const strictFormalRows = rows.filter((row) => row.formal_scope === "core" || row.formal_scope === "adjacent");

  await mkdir(outputDir, { recursive: true });

  const columns = [
    "formal_branch",
    "formal_scope",
    "field",
    "subfield",
    "sub_subfield",
    "keyword",
    "keyword_path",
    "keywords",
    "scholar_query",
    "google_scholar_url",
    "node_level",
    "section_code",
    "parent_code",
    "source_system",
    "source_tag",
    "source_code",
    "source_title",
    "source_url",
  ];

  await writeFile(
    path.join(outputDir, "formal_sciences_taxonomy_msc2020_full_scope.csv"),
    buildCsv(rows, columns),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_taxonomy_msc2020_core_adjacent.csv"),
    buildCsv(strictFormalRows, columns),
    "utf8",
  );

  const keywordRows = toKeywordRows(strictFormalRows);
  const keywordRowsFullScope = toKeywordRows(rows);
  const uniqueKeywordRows = buildUniqueKeywordRows(strictFormalRows);
  const uniqueKeywordRowsFullScope = buildUniqueKeywordRows(rows);

  await writeFile(
    path.join(outputDir, "formal_sciences_keywords_scholar_links.csv"),
    buildCsv(keywordRows, [
      "keyword",
      "keyword_ascii",
      "keyword_path",
      "keywords",
      "keywords_ascii",
      "scholar_query",
      "scholar_query_ascii",
      "google_scholar_url",
      "google_scholar_url_ascii",
      "formal_branch",
      "formal_scope",
      "field",
      "subfield",
      "sub_subfield",
      "node_level",
      "source_tag",
      "source_code",
      "source_title",
    ]),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_keywords_scholar_links_full_scope.csv"),
    buildCsv(keywordRowsFullScope, [
      "keyword",
      "keyword_ascii",
      "keyword_path",
      "keywords",
      "keywords_ascii",
      "scholar_query",
      "scholar_query_ascii",
      "google_scholar_url",
      "google_scholar_url_ascii",
      "formal_branch",
      "formal_scope",
      "field",
      "subfield",
      "sub_subfield",
      "node_level",
      "source_tag",
      "source_code",
      "source_title",
    ]),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_unique_keywords_scholar_links.csv"),
    buildCsv(uniqueKeywordRows, [
      "keyword",
      "keyword_ascii",
      "scholar_query",
      "scholar_query_ascii",
      "google_scholar_url",
      "google_scholar_url_ascii",
      "occurrences",
      "formal_branches",
      "formal_scopes",
      "fields",
      "source_tags",
      "source_codes",
      "source_titles",
    ]),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_unique_keywords_scholar_links_full_scope.csv"),
    buildCsv(uniqueKeywordRowsFullScope, [
      "keyword",
      "keyword_ascii",
      "scholar_query",
      "scholar_query_ascii",
      "google_scholar_url",
      "google_scholar_url_ascii",
      "occurrences",
      "formal_branches",
      "formal_scopes",
      "fields",
      "source_tags",
      "source_codes",
      "source_titles",
    ]),
    "utf8",
  );

  const summary = {
    source_system: "MSC2020",
    source_url: sourceUrl,
    total_rows_full_scope: rows.length,
    total_rows_core_adjacent: strictFormalRows.length,
    total_keyword_rows_full_scope: keywordRowsFullScope.length,
    total_keyword_rows_core_adjacent: keywordRows.length,
    total_unique_keywords_full_scope: uniqueKeywordRowsFullScope.length,
    total_unique_keywords_core_adjacent: uniqueKeywordRows.length,
    sections_included_core_adjacent: [...new Set(strictFormalRows.map((row) => row.section_code))].sort(),
  };

  await writeFile(
    path.join(outputDir, "formal_sciences_keywords_scholar_links_ascii.csv"),
    buildCsv(keywordRows.map((row) => ({
      keyword_ascii: row.keyword_ascii,
      scholar_query_ascii: row.scholar_query_ascii,
      google_scholar_url_ascii: row.google_scholar_url_ascii,
      formal_branch: row.formal_branch,
      formal_scope: row.formal_scope,
      field: row.field,
      subfield: row.subfield,
      sub_subfield: row.sub_subfield,
      node_level: row.node_level,
      source_tag: row.source_tag,
      source_code: row.source_code,
      source_title: row.source_title,
    })), [
      "keyword_ascii",
      "scholar_query_ascii",
      "google_scholar_url_ascii",
      "formal_branch",
      "formal_scope",
      "field",
      "subfield",
      "sub_subfield",
      "node_level",
      "source_tag",
      "source_code",
      "source_title",
    ]),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_unique_keywords_scholar_links_ascii.csv"),
    buildCsv(uniqueKeywordRows.map((row) => ({
      keyword_ascii: row.keyword_ascii,
      scholar_query_ascii: row.scholar_query_ascii,
      google_scholar_url_ascii: row.google_scholar_url_ascii,
      occurrences: row.occurrences,
      formal_branches: row.formal_branches,
      formal_scopes: row.formal_scopes,
      fields: row.fields,
      source_tags: row.source_tags,
      source_codes: row.source_codes,
      source_titles: row.source_titles,
    })), [
      "keyword_ascii",
      "scholar_query_ascii",
      "google_scholar_url_ascii",
      "occurrences",
      "formal_branches",
      "formal_scopes",
      "fields",
      "source_tags",
      "source_codes",
      "source_titles",
    ]),
    "utf8",
  );

  await writeFile(
    path.join(outputDir, "formal_sciences_taxonomy_msc2020_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
