from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

from app.core.config import Settings
from app.schemas import GenerateConceptTreeRequest, GeneratedConceptTree


class ConceptGenerationError(RuntimeError):
    pass


class ConceptService:
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.openai_api_key
        self.model_name = settings.openai_model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate(
        self,
        *,
        target_id: str,
        target_label: str,
        target_scheme: str,
        target_description: str | None,
        payload: GenerateConceptTreeRequest,
        lineage: list[str] | None = None,
        child_labels: list[str] | None = None,
    ) -> GeneratedConceptTree:
        if not self.api_key:
            raise ConceptGenerationError("OPENAI_API_KEY is not configured on the backend.")

        prompt = self._build_prompt(
            target_id=target_id,
            target_label=target_label,
            target_scheme=target_scheme,
            target_description=target_description,
            payload=payload,
            lineage=lineage or [],
            child_labels=child_labels or [],
        )
        parsed = self._call_openai(prompt)
        return GeneratedConceptTree(
            target_scheme=target_scheme,
            target_id=target_id,
            target_label=target_label,
            overview=self._safe_text(parsed.get("overview"), fallback=f"A learning map for {target_label}."),
            prerequisites=self._safe_list(parsed.get("prerequisites")),
            beginner_concepts=self._safe_list(parsed.get("beginner_concepts")),
            intermediate_concepts=self._safe_list(parsed.get("intermediate_concepts")),
            advanced_concepts=self._safe_list(parsed.get("advanced_concepts")),
            milestone_capabilities=self._safe_list(parsed.get("milestone_capabilities")),
            bibliography_strategy=self._safe_list(parsed.get("bibliography_strategy")),
            caution_notes=self._safe_list(parsed.get("caution_notes")),
            generated_at=datetime.now(timezone.utc),
            model=self.model_name,
        )

    def _build_prompt(
        self,
        *,
        target_id: str,
        target_label: str,
        target_scheme: str,
        target_description: str | None,
        payload: GenerateConceptTreeRequest,
        lineage: list[str],
        child_labels: list[str],
    ) -> str:
        return f"""
You are building a conservative learning map for mathematics.

Topic:
- Scheme: {target_scheme}
- Identifier: {target_id}
- Label: {target_label}
- Description: {target_description or "No further description was supplied."}
- Audience: {payload.audience}
- Focus: {payload.focus or "No special focus."}
- Lineage: {", ".join(lineage) or "Not available"}
- Official child labels: {", ".join(child_labels[:12]) or "Not available"}

Rules:
- Stay with canonical, widely recognized concepts only.
- Do not invent new terminology, schools, or subfields.
- The learning map is pedagogical, not a replacement for the official MSC hierarchy.
- Keep each bullet concise and plain.
- Return strict JSON only.

Return:
{{
  "overview": "2-3 sentences",
  "prerequisites": ["..."],
  "beginner_concepts": ["..."],
  "intermediate_concepts": ["..."],
  "advanced_concepts": ["..."],
  "milestone_capabilities": ["..."],
  "bibliography_strategy": ["..."],
  "caution_notes": ["..."]
}}
""".strip()

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
                                "Produce careful, conservative JSON for mathematics learning maps. "
                                "Avoid speculative claims."
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
                    "name": "concept_tree",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "overview": {"type": "string"},
                            "prerequisites": {"type": "array", "items": {"type": "string"}},
                            "beginner_concepts": {"type": "array", "items": {"type": "string"}},
                            "intermediate_concepts": {"type": "array", "items": {"type": "string"}},
                            "advanced_concepts": {"type": "array", "items": {"type": "string"}},
                            "milestone_capabilities": {"type": "array", "items": {"type": "string"}},
                            "bibliography_strategy": {"type": "array", "items": {"type": "string"}},
                            "caution_notes": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": [
                            "overview",
                            "prerequisites",
                            "beginner_concepts",
                            "intermediate_concepts",
                            "advanced_concepts",
                            "milestone_capabilities",
                            "bibliography_strategy",
                            "caution_notes",
                        ],
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
            raise ConceptGenerationError(f"OpenAI request failed: {detail or exc.reason}") from exc
        except error.URLError as exc:
            raise ConceptGenerationError(f"Unable to reach OpenAI: {exc.reason}") from exc

        text = payload.get("output_text")
        if not text:
            raise ConceptGenerationError("OpenAI returned no structured concept output.")

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ConceptGenerationError("OpenAI returned invalid JSON for the concept map.") from exc

    @staticmethod
    def _safe_text(value: Any, fallback: str = "") -> str:
        if value is None:
            return fallback
        cleaned = str(value).strip()
        return cleaned or fallback

    @staticmethod
    def _safe_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]
