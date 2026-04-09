from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from app.schemas import MscLevel, MscLineageNode, MscNodeDetail, MscNodeSummary, MscSearchResponse


SECTION_PATTERN = re.compile(r"^(?P<code>\d{2})-XX$")
BRANCH_PATTERN = re.compile(r"^(?P<code>\d{2}[A-Z])xx$")
LEAF_PATTERN = re.compile(r"^(?P<code>\d{2}[A-Z]\d{2})$")
AUXILIARY_PATTERN = re.compile(r"^(?P<code>\d{2}-\d{2})$")


@dataclass(frozen=True)
class MscRecord:
    code: str
    title: str
    description: str
    official_code: str
    level: MscLevel
    parent_code: str | None
    parent_title: str | None
    child_count: int = 0

    @property
    def is_leaf(self) -> bool:
        return self.child_count == 0

    def to_summary(self) -> MscNodeSummary:
        return MscNodeSummary(
            code=self.code,
            title=self.title,
            description=self.description,
            official_code=self.official_code,
            level=self.level,
            parent_code=self.parent_code,
            parent_title=self.parent_title,
            child_count=self.child_count,
            is_leaf=self.is_leaf,
        )


class MscCatalogService:
    def __init__(self, source_path: Path | None = None) -> None:
        self.source_path = source_path or Path(__file__).resolve().parents[1] / "MSC_2020.csv"
        (
            self._records,
            self._children,
            self._official_row_count,
            self._level_counts,
        ) = self._load_catalog()

    @property
    def catalog_size(self) -> int:
        return len(self._records)

    @property
    def official_row_count(self) -> int:
        return self._official_row_count

    @property
    def level_counts(self) -> dict[str, int]:
        return dict(self._level_counts)

    def root(self) -> list[MscNodeSummary]:
        return [self._records[code].to_summary() for code in self._children.get(None, [])]

    def search(self, query: str, limit: int = 24) -> MscSearchResponse:
        normalized = query.strip().lower()
        records = list(self._records.values())
        if normalized:
            records = [
                record
                for record in records
                if normalized in record.code.lower()
                or normalized in record.title.lower()
                or normalized in record.description.lower()
                or (record.parent_title and normalized in record.parent_title.lower())
            ]

        items = [record.to_summary() for record in records[:limit]]
        return MscSearchResponse(total=len(records), items=items)

    def get(self, code: str) -> MscNodeDetail | None:
        normalized = self._normalize_code(code)
        record = self._records.get(normalized)
        if record is None:
            return None
        return MscNodeDetail(
            **record.to_summary().model_dump(),
            lineage=self._build_lineage(normalized),
        )

    def get_children(self, code: str | None) -> list[MscNodeSummary]:
        normalized = self._normalize_code(code) if code else None
        child_codes = self._children.get(normalized, [])
        return [self._records[item].to_summary() for item in child_codes]

    def _build_lineage(self, code: str) -> list[MscLineageNode]:
        lineage: list[MscLineageNode] = []
        current = self._records.get(code)
        while current is not None:
            lineage.append(
                MscLineageNode(code=current.code, title=current.title, level=current.level)
            )
            current = self._records.get(current.parent_code) if current.parent_code else None
        lineage.reverse()
        return lineage

    def _load_catalog(
        self,
    ) -> tuple[dict[str, MscRecord], dict[str | None, list[str]], int, dict[str, int]]:
        if not self.source_path.exists():
            raise RuntimeError(f"Missing MSC catalog file at {self.source_path}")

        with self.source_path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle, delimiter="\t"))

        raw_records: dict[str, MscRecord] = {}
        for row in rows:
            official_code = (row.get("code") or "").strip()
            title = self._clean_text((row.get("text") or "").strip())
            description = self._clean_text((row.get("description") or "").strip()) or title
            if not official_code or not description:
                continue

            normalized, level, parent_code = self._classify_code(official_code)
            if normalized is None or level is None:
                continue

            raw_records[normalized] = MscRecord(
                code=normalized,
                title=title or description,
                description=description,
                official_code=official_code,
                level=level,
                parent_code=parent_code,
                parent_title=None,
            )

        children: dict[str | None, list[str]] = {}
        for code, record in raw_records.items():
            children.setdefault(record.parent_code, []).append(code)

        for group in children.values():
            group.sort()

        records: dict[str, MscRecord] = {}
        level_counts = {"section": 0, "branch": 0, "leaf": 0, "auxiliary": 0}
        for code, record in sorted(raw_records.items()):
            parent_title = raw_records[record.parent_code].title if record.parent_code else None
            child_count = len(children.get(code, []))
            records[code] = MscRecord(
                code=record.code,
                title=record.title,
                description=record.description,
                official_code=record.official_code,
                level=record.level,
                parent_code=record.parent_code,
                parent_title=parent_title,
                child_count=child_count,
            )
            level_counts[record.level] += 1

        return records, children, len(rows), level_counts

    def _classify_code(self, official_code: str) -> tuple[str | None, MscLevel | None, str | None]:
        if match := SECTION_PATTERN.match(official_code):
            code = match.group("code")
            return code, "section", None
        if match := BRANCH_PATTERN.match(official_code):
            code = match.group("code")
            return code, "branch", code[:2]
        if match := LEAF_PATTERN.match(official_code):
            code = match.group("code")
            return code, "leaf", code[:3]
        if match := AUXILIARY_PATTERN.match(official_code):
            code = match.group("code")
            return code, "auxiliary", code[:2]
        return None, None, None

    @staticmethod
    def _normalize_code(code: str | None) -> str:
        if not code:
            return ""
        normalized = code.strip().upper()
        if len(normalized) == 5 and normalized.endswith("XX"):
            return normalized[:3]
        if len(normalized) == 5 and normalized.endswith("-XX"):
            return normalized[:2]
        return normalized

    @staticmethod
    def _clean_text(value: str) -> str:
        cleaned = value.replace("{", "(").replace("}", ")")
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()
