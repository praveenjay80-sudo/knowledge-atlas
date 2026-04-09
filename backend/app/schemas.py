from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


Audience = Literal["beginner", "broad", "graduate", "research"]
Confidence = Literal["high", "medium", "low"]
MscLevel = Literal["section", "branch", "leaf", "auxiliary"]
VocabularyScheme = Literal["msc", "lcsh", "gnd"]


class MscLineageNode(BaseModel):
    code: str
    title: str
    level: MscLevel


class MscNodeSummary(BaseModel):
    code: str
    title: str
    description: str
    official_code: str
    level: MscLevel
    parent_code: str | None = None
    parent_title: str | None = None
    child_count: int = 0
    is_leaf: bool = False


class MscNodeDetail(MscNodeSummary):
    lineage: list[MscLineageNode] = Field(default_factory=list)


class MscSearchResponse(BaseModel):
    total: int
    items: list[MscNodeSummary]


class ControlledVocabularyTerm(BaseModel):
    scheme: Literal["lcsh", "gnd"]
    label: str
    identifier: str | None = None
    uri: str | None = None
    source_url: str | None = None
    match_type: Literal["exact", "close", "related", "search"]
    note: str | None = None


class ControlledVocabularyGroup(BaseModel):
    scheme: Literal["lcsh", "gnd"]
    heading: str
    search_url: str
    warning: str | None = None
    terms: list[ControlledVocabularyTerm] = Field(default_factory=list)


class ControlledVocabularyResponse(BaseModel):
    code: str
    title: str
    description: str
    groups: list[ControlledVocabularyGroup] = Field(default_factory=list)
    generated_at: datetime


class GenerateBibliographyRequest(BaseModel):
    target_scheme: VocabularyScheme = "msc"
    code: str | None = None
    label: str | None = None
    description: str | None = None
    focus: str | None = None
    audience: Audience = "graduate"
    max_entries: int = Field(default=10, ge=4, le=16)
    notes: str | None = None

    @model_validator(mode="after")
    def normalize_and_validate(self) -> "GenerateBibliographyRequest":
        if self.code is not None:
            self.code = self.code.strip().upper() or None
        if self.label is not None:
            self.label = self.label.strip() or None
        if self.description is not None:
            self.description = self.description.strip() or None
        if self.focus is not None:
            self.focus = self.focus.strip() or None
        if self.notes is not None:
            self.notes = self.notes.strip() or None

        if self.target_scheme == "msc" and not self.code:
            raise ValueError("An MSC code is required when target_scheme is 'msc'.")
        if self.target_scheme in {"lcsh", "gnd"} and not self.label:
            raise ValueError("A label is required when target_scheme is 'lcsh' or 'gnd'.")
        return self


class BibliographySourceLink(BaseModel):
    source: Literal["crossref", "openalex"]
    label: str
    url: str


class BibliographyEntry(BaseModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    work_type: str | None = None
    doi: str | None = None
    url: str | None = None
    citation_count: int | None = None
    rationale: str
    confidence: Confidence = "medium"
    source_links: list[BibliographySourceLink] = Field(default_factory=list)


class BibliographySection(BaseModel):
    key: str
    label: str
    description: str
    entries: list[BibliographyEntry] = Field(default_factory=list)


class GeneratedBibliography(BaseModel):
    target_scheme: VocabularyScheme
    target_id: str
    target_label: str
    description: str | None = None
    audience: Audience
    focus: str | None = None
    overview: str
    sections: list[BibliographySection] = Field(default_factory=list)
    search_guidance: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    grounded: bool = True
    generated_at: datetime
    model: str


class GenerateConceptTreeRequest(BaseModel):
    target_scheme: VocabularyScheme = "msc"
    code: str | None = None
    label: str | None = None
    description: str | None = None
    focus: str | None = None
    audience: Audience = "graduate"

    @model_validator(mode="after")
    def normalize_and_validate(self) -> "GenerateConceptTreeRequest":
        if self.code is not None:
            self.code = self.code.strip().upper() or None
        if self.label is not None:
            self.label = self.label.strip() or None
        if self.description is not None:
            self.description = self.description.strip() or None
        if self.focus is not None:
            self.focus = self.focus.strip() or None

        if self.target_scheme == "msc" and not self.code:
            raise ValueError("An MSC code is required when target_scheme is 'msc'.")
        if self.target_scheme in {"lcsh", "gnd"} and not self.label:
            raise ValueError("A label is required when target_scheme is 'lcsh' or 'gnd'.")
        return self


class GeneratedConceptTree(BaseModel):
    target_scheme: VocabularyScheme
    target_id: str
    target_label: str
    overview: str
    prerequisites: list[str] = Field(default_factory=list)
    beginner_concepts: list[str] = Field(default_factory=list)
    intermediate_concepts: list[str] = Field(default_factory=list)
    advanced_concepts: list[str] = Field(default_factory=list)
    milestone_capabilities: list[str] = Field(default_factory=list)
    bibliography_strategy: list[str] = Field(default_factory=list)
    caution_notes: list[str] = Field(default_factory=list)
    generated_at: datetime
    model: str
