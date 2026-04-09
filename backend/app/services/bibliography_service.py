from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib import error, parse, request

from app.core.config import Settings
from app.schemas import (
    BibliographyEntry,
    BibliographySection,
    BibliographySourceLink,
    GenerateBibliographyRequest,
    GeneratedBibliography,
    MscNodeDetail,
)


class BibliographyGenerationError(RuntimeError):
    pass


@dataclass
class CandidateWork:
    candidate_id: str
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    work_type: str | None = None
    doi: str | None = None
    url: str | None = None
    citation_count: int | None = None
    source_links: list[BibliographySourceLink] = field(default_factory=list)
    source_names: set[str] = field(default_factory=set)
    relevance_score: float = 0.0

    def merge(self, other: "CandidateWork") -> None:
        if not self.authors and other.authors:
            self.authors = other.authors
        if self.year is None and other.year is not None:
            self.year = other.year
        if not self.venue and other.venue:
            self.venue = other.venue
        if not self.work_type and other.work_type:
            self.work_type = other.work_type
        if not self.doi and other.doi:
            self.doi = other.doi
        if not self.url and other.url:
            self.url = other.url
        if other.citation_count is not None:
            self.citation_count = max(self.citation_count or 0, other.citation_count)
        self.source_names.update(other.source_names)
        self.relevance_score = max(self.relevance_score, other.relevance_score)
        existing_urls = {link.url for link in self.source_links}
        for link in other.source_links:
            if link.url not in existing_urls:
                self.source_links.append(link)
                existing_urls.add(link.url)


class BibliographyService:
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.openai_api_key
        self.model_name = settings.openai_model
        self.crossref_mailto = settings.crossref_mailto
        self.openalex_email = settings.openalex_email

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate(
        self,
        *,
        target_scheme: str,
        target_id: str,
        target_label: str,
        target_description: str | None,
        payload: GenerateBibliographyRequest,
    ) -> GeneratedBibliography:
        queries = self._build_queries(
            target_scheme=target_scheme,
            target_id=target_id,
            target_label=target_label,
            focus=payload.focus,
        )
        candidates = self._retrieve_candidates(queries, target_label)
        if not candidates:
            raise BibliographyGenerationError(
                "No grounded bibliography candidates were found from Crossref or OpenAlex."
            )

        caveats: list[str] = []
        search_guidance = [f"Crossref/OpenAlex query: {query}" for query in queries]

        sections: list[BibliographySection]
        model_name = "grounded-heuristic"
        overview = (
            f"Grounded bibliography candidates for {target_label}, assembled from Crossref and OpenAlex. "
            "These entries are filtered and grouped conservatively to reduce fabricated citations."
        )

        if self.api_key:
            try:
                sections, overview, model_caveats = self._select_with_model(
                    target_scheme=target_scheme,
                    target_id=target_id,
                    target_label=target_label,
                    target_description=target_description,
                    payload=payload,
                    candidates=candidates,
                )
                caveats.extend(model_caveats)
                model_name = self.model_name
            except BibliographyGenerationError as exc:
                caveats.append(str(exc))
                sections = self._heuristic_sections(candidates, payload.max_entries)
        else:
            caveats.append(
                "OPENAI_API_KEY is not configured, so bibliography grouping is heuristic even though citations are grounded."
            )
            sections = self._heuristic_sections(candidates, payload.max_entries)

        return GeneratedBibliography(
            target_scheme=target_scheme,
            target_id=target_id,
            target_label=target_label,
            description=target_description,
            audience=payload.audience,
            focus=payload.focus,
            overview=overview,
            sections=sections,
            search_guidance=search_guidance,
            caveats=caveats,
            grounded=True,
            generated_at=datetime.now(timezone.utc),
            model=model_name,
        )

    def generate_for_record(
        self,
        *,
        record: MscNodeDetail,
        payload: GenerateBibliographyRequest,
    ) -> GeneratedBibliography:
        return self.generate(
            target_scheme="msc",
            target_id=record.code,
            target_label=record.title,
            target_description=record.description,
            payload=payload,
        )

    def _build_queries(
        self,
        *,
        target_scheme: str,
        target_id: str,
        target_label: str,
        focus: str | None,
    ) -> list[str]:
        candidates = [target_label]
        if target_scheme == "msc":
            candidates.append(f"{target_id} {target_label}")
            candidates.append(f"{target_label} mathematics")
        if focus:
            candidates.append(f"{target_label} {focus}")

        queries: list[str] = []
        seen: set[str] = set()
        for item in candidates:
            normalized = re.sub(r"\s+", " ", item).strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            queries.append(normalized)
        return queries[:3]

    def _retrieve_candidates(self, queries: list[str], target_label: str) -> list[CandidateWork]:
        candidates: dict[str, CandidateWork] = {}
        for query in queries:
            for candidate in self._fetch_crossref(query, target_label):
                self._merge_candidate(candidates, candidate)
            for candidate in self._fetch_openalex(query, target_label):
                self._merge_candidate(candidates, candidate)
        ordered = sorted(candidates.values(), key=lambda item: item.relevance_score, reverse=True)
        return ordered[:24]

    def _merge_candidate(self, candidates: dict[str, CandidateWork], candidate: CandidateWork) -> None:
        key = candidate.doi or self._title_key(candidate.title, candidate.year)
        existing = candidates.get(key)
        if existing:
            existing.merge(candidate)
        else:
            candidates[key] = candidate

    def _fetch_crossref(self, query_text: str, target_label: str) -> list[CandidateWork]:
        params = {
            "query.bibliographic": query_text,
            "rows": "10",
            "select": ",".join(
                [
                    "DOI",
                    "URL",
                    "title",
                    "author",
                    "issued",
                    "container-title",
                    "type",
                    "is-referenced-by-count",
                ]
            ),
        }
        if self.crossref_mailto:
            params["mailto"] = self.crossref_mailto
        url = "https://api.crossref.org/works?" + parse.urlencode(params)
        response_payload = self._fetch_json(url, source_name="Crossref")
        items = ((response_payload.get("message") or {}).get("items") or [])[:10]
        works: list[CandidateWork] = []
        for index, item in enumerate(items):
            title = self._first_string(item.get("title")) or "Untitled work"
            authors = self._crossref_authors(item.get("author"))
            year = self._extract_crossref_year(item.get("issued"))
            venue = self._first_string(item.get("container-title"))
            citation_count = self._safe_int(item.get("is-referenced-by-count"))
            doi = self._normalize_doi(item.get("DOI"))
            url_value = item.get("URL")
            source_url = (
                f"https://doi.org/{doi}"
                if doi
                else url_value if isinstance(url_value, str) else url
            )
            candidate = CandidateWork(
                candidate_id=f"crossref-{index}-{self._title_key(title, year)}",
                title=title,
                authors=authors,
                year=year,
                venue=venue,
                work_type=self._safe_text(item.get("type")),
                doi=doi,
                url=url_value if isinstance(url_value, str) else None,
                citation_count=citation_count,
                source_links=[
                    BibliographySourceLink(source="crossref", label="Crossref record", url=source_url)
                ],
                source_names={"crossref"},
            )
            candidate.relevance_score = self._score_candidate(candidate, target_label)
            works.append(candidate)
        return works

    def _fetch_openalex(self, query_text: str, target_label: str) -> list[CandidateWork]:
        params = {"search": query_text, "per-page": "10", "sort": "cited_by_count:desc"}
        if self.openalex_email:
            params["mailto"] = self.openalex_email
        url = "https://api.openalex.org/works?" + parse.urlencode(params)
        response_payload = self._fetch_json(url, source_name="OpenAlex")
        items = (response_payload.get("results") or [])[:10]
        works: list[CandidateWork] = []
        for index, item in enumerate(items):
            title = self._safe_text(item.get("display_name"), fallback="Untitled work")
            authors = self._openalex_authors(item.get("authorships"))
            year = self._safe_int(item.get("publication_year"))
            primary_location = item.get("primary_location") or {}
            source = primary_location.get("source") or {}
            venue = self._safe_text(source.get("display_name"))
            doi = self._normalize_doi(item.get("doi"))
            landing_page_url = primary_location.get("landing_page_url")
            openalex_id = item.get("id")
            candidate = CandidateWork(
                candidate_id=f"openalex-{index}-{self._title_key(title, year)}",
                title=title,
                authors=authors,
                year=year,
                venue=venue,
                work_type=self._safe_text(item.get("type")),
                doi=doi,
                url=landing_page_url if isinstance(landing_page_url, str) else None,
                citation_count=self._safe_int(item.get("cited_by_count")),
                source_links=[
                    BibliographySourceLink(
                        source="openalex",
                        label="OpenAlex record",
                        url=openalex_id if isinstance(openalex_id, str) else url,
                    )
                ],
                source_names={"openalex"},
            )
            candidate.relevance_score = self._score_candidate(candidate, target_label)
            works.append(candidate)
        return works

    def _select_with_model(
        self,
        *,
        target_scheme: str,
        target_id: str,
        target_label: str,
        target_description: str | None,
        payload: GenerateBibliographyRequest,
        candidates: list[CandidateWork],
    ) -> tuple[list[BibliographySection], str, list[str]]:
        candidate_payload = [
            {
                "id": candidate.candidate_id,
                "title": candidate.title,
                "authors": candidate.authors,
                "year": candidate.year,
                "venue": candidate.venue,
                "work_type": candidate.work_type,
                "doi": candidate.doi,
                "url": candidate.url,
                "citation_count": candidate.citation_count,
                "sources": sorted(candidate.source_names),
            }
            for candidate in candidates[:18]
        ]
        prompt = f"""
You are curating a grounded mathematics bibliography.

Topic:
- Scheme: {target_scheme}
- Identifier: {target_id}
- Label: {target_label}
- Description: {target_description or "No description available."}
- Audience: {payload.audience}
- Focus: {payload.focus or "No special focus."}
- User notes: {payload.notes or "No additional notes."}
- Maximum total entries: {payload.max_entries}

Rules:
- Use only the provided candidate ids.
- Do not invent any new titles, authors, years, or citations.
- Prefer canonical, field-defining works and standard references.
- Keep the number of selected entries at or below the maximum.
- Return strict JSON only.

Candidate works:
{json.dumps(candidate_payload, ensure_ascii=False)}

Return:
{{
  "overview": "2-3 sentences",
  "caveats": ["..."],
  "sections": [
    {{
      "key": "foundational_works",
      "label": "Foundational works",
      "description": "Why these entries belong together",
      "entries": [
        {{
          "candidate_id": "candidate id",
          "rationale": "why this work belongs in the bibliography",
          "confidence": "high"
        }}
      ]
    }}
  ]
}}
""".strip()

        response_payload = self._call_openai(prompt)
        raw_sections = response_payload.get("sections")
        if not isinstance(raw_sections, list):
            raise BibliographyGenerationError("OpenAI returned an invalid bibliography structure.")

        by_id = {candidate.candidate_id: candidate for candidate in candidates}
        used: set[str] = set()
        sections: list[BibliographySection] = []
        total_entries = 0
        for raw_section in raw_sections:
            if not isinstance(raw_section, dict):
                continue
            key = self._safe_text(raw_section.get("key"), fallback="miscellaneous")
            label = self._safe_text(raw_section.get("label"), fallback="Selected works")
            description = self._safe_text(
                raw_section.get("description"), fallback="Grounded works relevant to the topic."
            )
            entries: list[BibliographyEntry] = []
            for raw_entry in raw_section.get("entries", []):
                if not isinstance(raw_entry, dict):
                    continue
                candidate_id = self._safe_text(raw_entry.get("candidate_id"))
                candidate = by_id.get(candidate_id)
                if candidate is None or candidate_id in used:
                    continue
                used.add(candidate_id)
                confidence = self._normalize_confidence(raw_entry.get("confidence"))
                entries.append(
                    BibliographyEntry(
                        title=candidate.title,
                        authors=candidate.authors,
                        year=candidate.year,
                        venue=candidate.venue,
                        work_type=candidate.work_type,
                        doi=candidate.doi,
                        url=candidate.url,
                        citation_count=candidate.citation_count,
                        rationale=self._safe_text(
                            raw_entry.get("rationale"),
                            fallback="A grounded candidate selected for topical relevance.",
                        ),
                        confidence=confidence,
                        source_links=candidate.source_links,
                    )
                )
                total_entries += 1
                if total_entries >= payload.max_entries:
                    break
            if entries:
                sections.append(
                    BibliographySection(
                        key=key,
                        label=label,
                        description=description,
                        entries=entries,
                    )
                )
            if total_entries >= payload.max_entries:
                break

        if not sections:
            raise BibliographyGenerationError("OpenAI did not select any grounded bibliography entries.")

        overview = self._safe_text(
            response_payload.get("overview"),
            fallback=(
                f"Grounded bibliography candidates for {target_label}, selected from Crossref and OpenAlex."
            ),
        )
        caveats = self._safe_list(response_payload.get("caveats"))
        return sections, overview, caveats

    def _call_openai(self, prompt: str) -> dict[str, Any]:
        body = {
            "model": self.model_name,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Select grounded bibliography entries conservatively. "
                                "Never invent citations or candidate ids."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "grounded_bibliography",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "overview": {"type": "string"},
                            "caveats": {"type": "array", "items": {"type": "string"}},
                            "sections": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "key": {"type": "string"},
                                        "label": {"type": "string"},
                                        "description": {"type": "string"},
                                        "entries": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "additionalProperties": False,
                                                "properties": {
                                                    "candidate_id": {"type": "string"},
                                                    "rationale": {"type": "string"},
                                                    "confidence": {
                                                        "type": "string",
                                                        "enum": ["high", "medium", "low"],
                                                    },
                                                },
                                                "required": [
                                                    "candidate_id",
                                                    "rationale",
                                                    "confidence",
                                                ],
                                            },
                                        },
                                    },
                                    "required": ["key", "label", "description", "entries"],
                                },
                            },
                        },
                        "required": ["overview", "caveats", "sections"],
                    },
                }
            },
        }

        req = request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise BibliographyGenerationError(f"OpenAI request failed: {detail or exc.reason}") from exc
        except error.URLError as exc:
            raise BibliographyGenerationError(f"Unable to reach OpenAI: {exc.reason}") from exc

        text = payload.get("output_text")
        if not text:
            raise BibliographyGenerationError("OpenAI returned no grounded bibliography selection.")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise BibliographyGenerationError("OpenAI returned invalid grounded bibliography JSON.") from exc

    def _heuristic_sections(
        self,
        candidates: list[CandidateWork],
        max_entries: int,
    ) -> list[BibliographySection]:
        selected = candidates[:max_entries]
        remaining = list(selected)
        sections: list[BibliographySection] = []

        buckets = [
            ("reference_texts", "Reference texts", "Books and broad references that orient the area."),
            ("foundational_works", "Foundational works", "Older or highly cited works that anchor the topic."),
            ("survey_overviews", "Surveys and overviews", "Orientation pieces that consolidate the field."),
            ("recent_pathfinders", "Recent pathways", "More recent items that point toward current directions."),
        ]

        for key, label, description in buckets:
            entries: list[BibliographyEntry] = []
            next_remaining: list[CandidateWork] = []
            for candidate in remaining:
                if self._belongs_to_bucket(candidate, key) and len(entries) < max(1, max_entries // 4):
                    entries.append(self._candidate_to_entry(candidate))
                else:
                    next_remaining.append(candidate)
            remaining = next_remaining
            if entries:
                sections.append(
                    BibliographySection(
                        key=key,
                        label=label,
                        description=description,
                        entries=entries,
                    )
                )

        if remaining:
            sections.append(
                BibliographySection(
                    key="additional_relevant_works",
                    label="Additional relevant works",
                    description="Grounded candidates that still fit the topic but were not more specifically classified.",
                    entries=[self._candidate_to_entry(candidate) for candidate in remaining],
                )
            )
        return sections

    def _belongs_to_bucket(self, candidate: CandidateWork, bucket: str) -> bool:
        title = candidate.title.lower()
        work_type = (candidate.work_type or "").lower()
        year = candidate.year or 0
        current_year = datetime.now(timezone.utc).year

        if bucket == "reference_texts":
            return "book" in work_type or any(
                token in title for token in ("introduction", "handbook", "textbook", "treatise")
            )
        if bucket == "foundational_works":
            return (candidate.citation_count or 0) >= 30 or (year and year <= current_year - 15)
        if bucket == "survey_overviews":
            return any(token in title for token in ("survey", "overview", "handbook", "guide"))
        if bucket == "recent_pathfinders":
            return year >= current_year - 8 if year else False
        return False

    def _candidate_to_entry(self, candidate: CandidateWork) -> BibliographyEntry:
        return BibliographyEntry(
            title=candidate.title,
            authors=candidate.authors,
            year=candidate.year,
            venue=candidate.venue,
            work_type=candidate.work_type,
            doi=candidate.doi,
            url=candidate.url,
            citation_count=candidate.citation_count,
            rationale="Grounded candidate selected from Crossref/OpenAlex metadata and ranked conservatively.",
            confidence=self._confidence_from_candidate(candidate),
            source_links=candidate.source_links,
        )

    def _score_candidate(self, candidate: CandidateWork, target_label: str) -> float:
        target_tokens = {
            token
            for token in re.findall(r"[a-z0-9]+", target_label.lower())
            if len(token) > 2
        }
        title_tokens = {
            token
            for token in re.findall(r"[a-z0-9]+", candidate.title.lower())
            if len(token) > 2
        }
        overlap = len(target_tokens & title_tokens)
        title_score = overlap / max(len(target_tokens), 1)
        citation_score = min(math.log1p(candidate.citation_count or 0) / 6, 1.5)
        source_bonus = 0.35 if len(candidate.source_names) > 1 else 0
        type_bonus = 0.25 if "book" in (candidate.work_type or "").lower() else 0
        age_bonus = 0.0
        if candidate.year:
            age_bonus = min(max(datetime.now(timezone.utc).year - candidate.year, 0) / 60, 0.8)
        return title_score * 2 + citation_score + source_bonus + type_bonus + age_bonus

    def _fetch_json(self, url: str, *, source_name: str) -> dict[str, Any]:
        req = request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "MSC-Math-Atlas/1.0",
            },
        )
        try:
            with request.urlopen(req, timeout=25) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise BibliographyGenerationError(
                f"{source_name} request failed: {detail or exc.reason}"
            ) from exc
        except error.URLError as exc:
            raise BibliographyGenerationError(f"Unable to reach {source_name}: {exc.reason}") from exc

    @staticmethod
    def _crossref_authors(raw_authors: Any) -> list[str]:
        if not isinstance(raw_authors, list):
            return []
        authors: list[str] = []
        for item in raw_authors:
            if not isinstance(item, dict):
                continue
            given = str(item.get("given") or "").strip()
            family = str(item.get("family") or "").strip()
            full = " ".join(part for part in (given, family) if part)
            if full:
                authors.append(full)
        return authors

    @staticmethod
    def _openalex_authors(raw_authorships: Any) -> list[str]:
        if not isinstance(raw_authorships, list):
            return []
        authors: list[str] = []
        for item in raw_authorships:
            if not isinstance(item, dict):
                continue
            author = item.get("author") or {}
            name = str(author.get("display_name") or "").strip()
            if name:
                authors.append(name)
        return authors

    @staticmethod
    def _extract_crossref_year(issued: Any) -> int | None:
        if not isinstance(issued, dict):
            return None
        parts = issued.get("date-parts")
        if not isinstance(parts, list) or not parts or not isinstance(parts[0], list) or not parts[0]:
            return None
        return BibliographyService._safe_int(parts[0][0])

    @staticmethod
    def _first_string(value: Any) -> str | None:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        if isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item.strip():
                    return item.strip()
        return None

    @staticmethod
    def _title_key(title: str, year: int | None) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        return f"{normalized}-{year or 'na'}"

    @staticmethod
    def _normalize_doi(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        return cleaned.removeprefix("https://doi.org/").removeprefix("http://doi.org/")

    @staticmethod
    def _normalize_confidence(value: Any) -> str:
        cleaned = str(value or "medium").strip().lower()
        if cleaned in {"high", "medium", "low"}:
            return cleaned
        return "medium"

    @staticmethod
    def _confidence_from_candidate(candidate: CandidateWork) -> str:
        if candidate.doi and len(candidate.source_names) > 1:
            return "high"
        if candidate.doi or len(candidate.source_names) > 1 or (candidate.citation_count or 0) >= 40:
            return "medium"
        return "low"

    @staticmethod
    def _safe_text(value: Any, fallback: str = "") -> str:
        if value is None:
            return fallback
        cleaned = str(value).strip()
        return cleaned or fallback

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    @staticmethod
    def _safe_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]
