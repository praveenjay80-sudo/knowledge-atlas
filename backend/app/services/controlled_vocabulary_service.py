from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Iterable
from urllib import error, parse, request

from app.schemas import (
    ControlledVocabularyGroup,
    ControlledVocabularyResponse,
    ControlledVocabularyTerm,
    MscNodeDetail,
)


class ControlledVocabularyService:
    def lookup_for_msc(self, node: MscNodeDetail, limit: int = 4) -> ControlledVocabularyResponse:
        return ControlledVocabularyResponse(
            code=node.code,
            title=node.title,
            description=node.description,
            groups=[
                self._lookup_lcsh(node.title, limit=limit),
                self._lookup_gnd(node.title, limit=limit),
            ],
            generated_at=datetime.now(timezone.utc),
        )

    def _lookup_lcsh(self, label: str, limit: int) -> ControlledVocabularyGroup:
        search_url = (
            "https://id.loc.gov/search/?"
            + parse.urlencode(
                [
                    ("q", label),
                    ("q", "cs:http://id.loc.gov/authorities/subjects"),
                ]
            )
        )
        try:
            raw_html = self._fetch_text(search_url)
            terms = self._parse_lcsh_html(raw_html, label, limit)
            warning = None if terms else "No LCSH subject-heading match was found for this label."
        except RuntimeError as exc:
            terms = []
            warning = str(exc)

        return ControlledVocabularyGroup(
            scheme="lcsh",
            heading="Library of Congress Subject Headings",
            search_url=search_url,
            warning=warning,
            terms=terms,
        )

    def _lookup_gnd(self, label: str, limit: int) -> ControlledVocabularyGroup:
        query = f'WOE="{label}" and BBG=Ts*'
        search_url = (
            "https://services.dnb.de/sru/authorities?"
            + parse.urlencode(
                {
                    "version": "1.1",
                    "operation": "searchRetrieve",
                    "query": query,
                    "recordSchema": "MARC21-xml",
                    "maximumRecords": str(limit),
                }
            )
        )
        try:
            raw_xml = self._fetch_text(search_url)
            terms = self._parse_gnd_xml(raw_xml, label, limit)
            warning = None if terms else "No GND subject-heading match was found for this label."
        except RuntimeError as exc:
            terms = []
            warning = str(exc)

        return ControlledVocabularyGroup(
            scheme="gnd",
            heading="German National Library Subject Headings (GND)",
            search_url=search_url,
            warning=warning,
            terms=terms,
        )

    def _parse_lcsh_html(self, raw_html: str, label: str, limit: int) -> list[ControlledVocabularyTerm]:
        matches = re.finditer(
            r'href="(?P<href>(?:https?://id\.loc\.gov|/authorities/subjects/)[^"#?]+)"[^>]*>(?P<label>.*?)</a>',
            raw_html,
            re.IGNORECASE | re.DOTALL,
        )

        seen: set[str] = set()
        terms: list[ControlledVocabularyTerm] = []
        for match in matches:
            href = html.unescape(match.group("href")).strip()
            if "/authorities/subjects/" not in href:
                continue
            uri = href if href.startswith("http") else f"https://id.loc.gov{href}"
            identifier = uri.rsplit("/", 1)[-1]
            if identifier in seen:
                continue
            candidate_label = self._strip_tags(match.group("label"))
            if not candidate_label:
                continue
            seen.add(identifier)
            terms.append(
                ControlledVocabularyTerm(
                    scheme="lcsh",
                    label=candidate_label,
                    identifier=identifier,
                    uri=uri,
                    source_url=uri + ".html",
                    match_type=self._match_type(label, candidate_label),
                )
            )
            if len(terms) >= limit:
                break
        return terms

    def _parse_gnd_xml(self, raw_xml: str, label: str, limit: int) -> list[ControlledVocabularyTerm]:
        ns = {"marc": "http://www.loc.gov/MARC21/slim"}
        root = ET.fromstring(raw_xml)
        terms: list[ControlledVocabularyTerm] = []

        for record in root.findall(".//marc:record", ns):
            identifier = self._first_subfield(record, ns, "024", "a") or self._controlfield(record, ns, "001")
            heading = self._marc_joined_heading(record, ns)
            if not heading:
                continue
            identifier = identifier.replace("(DE-588)", "").strip() if identifier else None
            uri = f"https://d-nb.info/gnd/{identifier}" if identifier else None
            terms.append(
                ControlledVocabularyTerm(
                    scheme="gnd",
                    label=heading,
                    identifier=identifier,
                    uri=uri,
                    source_url=uri,
                    match_type=self._match_type(label, heading),
                )
            )
            if len(terms) >= limit:
                break

        return self._dedupe_terms(terms)

    def _marc_joined_heading(
        self,
        record: ET.Element,
        ns: dict[str, str],
    ) -> str | None:
        for tag in ("150", "151", "155"):
            field = record.find(f'.//marc:datafield[@tag="{tag}"]', ns)
            if field is None:
                continue
            values = [
                self._strip_tags(subfield.text or "")
                for subfield in field.findall("marc:subfield", ns)
                if (subfield.text or "").strip()
            ]
            joined = " -- ".join(value for value in values if value)
            if joined:
                return joined
        return None

    def _first_subfield(
        self,
        record: ET.Element,
        ns: dict[str, str],
        tag: str,
        code: str,
    ) -> str | None:
        element = record.find(f'.//marc:datafield[@tag="{tag}"]/marc:subfield[@code="{code}"]', ns)
        if element is None or element.text is None:
            return None
        return element.text.strip() or None

    def _controlfield(self, record: ET.Element, ns: dict[str, str], tag: str) -> str | None:
        element = record.find(f'.//marc:controlfield[@tag="{tag}"]', ns)
        if element is None or element.text is None:
            return None
        return element.text.strip() or None

    def _fetch_text(self, url: str) -> str:
        req = request.Request(
            url,
            headers={
                "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
                "User-Agent": "MSC-Math-Atlas/1.0",
            },
        )
        try:
            with request.urlopen(req, timeout=20) as response:
                body = response.read()
                charset = response.headers.get_content_charset() or "utf-8"
                return body.decode(charset, errors="replace")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Authoritative vocabulary lookup failed: {detail or exc.reason}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Unable to reach the authoritative vocabulary service: {exc.reason}") from exc

    @staticmethod
    def _match_type(query: str, candidate: str) -> str:
        normalized_query = ControlledVocabularyService._normalize_label(query)
        normalized_candidate = ControlledVocabularyService._normalize_label(candidate)
        if normalized_query == normalized_candidate:
            return "exact"
        if normalized_query in normalized_candidate or normalized_candidate in normalized_query:
            return "close"
        return "search"

    @staticmethod
    def _normalize_label(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    @staticmethod
    def _strip_tags(value: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", value)
        cleaned = html.unescape(cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    @staticmethod
    def _dedupe_terms(terms: Iterable[ControlledVocabularyTerm]) -> list[ControlledVocabularyTerm]:
        unique: list[ControlledVocabularyTerm] = []
        seen: set[tuple[str, str]] = set()
        for term in terms:
            key = (term.scheme, term.identifier or term.label.lower())
            if key in seen:
                continue
            seen.add(key)
            unique.append(term)
        return unique
