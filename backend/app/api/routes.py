from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas import GenerateBibliographyRequest, GenerateConceptTreeRequest
from app.service_registry import initialize_services
from app.services.bibliography_service import BibliographyGenerationError, BibliographyService
from app.services.concept_service import ConceptGenerationError, ConceptService
from app.services.controlled_vocabulary_service import ControlledVocabularyService
from app.services.msc_service import MscCatalogService


router = APIRouter()


def get_catalog(request: Request) -> MscCatalogService:
    initialize_services(request.app)
    service = getattr(request.app.state, "catalog_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="MSC catalog is unavailable.")
    return service


def get_bibliography_service(request: Request) -> BibliographyService:
    initialize_services(request.app)
    service = getattr(request.app.state, "bibliography_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Bibliography service is unavailable.")
    return service


def get_concept_service(request: Request) -> ConceptService:
    initialize_services(request.app)
    service = getattr(request.app.state, "concept_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Concept service is unavailable.")
    return service


def get_vocabulary_service(request: Request) -> ControlledVocabularyService:
    initialize_services(request.app)
    service = getattr(request.app.state, "vocabulary_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Controlled vocabulary service is unavailable.")
    return service


@router.get("/health")
def health(request: Request) -> dict[str, object]:
    catalog = get_catalog(request)
    bibliography_service = get_bibliography_service(request)
    concept_service = get_concept_service(request)
    return {
        "ok": True,
        "catalogCount": catalog.catalog_size,
        "officialRowCount": catalog.official_row_count,
        "levelCounts": catalog.level_counts,
        "groundedBibliographyModelConfigured": bibliography_service.is_configured,
        "learningModelConfigured": concept_service.is_configured,
        "model": bibliography_service.model_name,
    }


@router.get("/catalog/root")
def catalog_root(request: Request):
    return get_catalog(request).root()


@router.get("/catalog")
def catalog(
    request: Request,
    q: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
):
    return get_catalog(request).search(q or "", limit=limit)


@router.get("/catalog/{code}")
def catalog_detail(request: Request, code: str):
    record = get_catalog(request).get(code)
    if record is None:
        raise HTTPException(status_code=404, detail="MSC 2020 code not found.")
    return record


@router.get("/catalog/{code}/children")
def catalog_children(request: Request, code: str):
    catalog_service = get_catalog(request)
    record = catalog_service.get(code)
    if record is None:
        raise HTTPException(status_code=404, detail="MSC 2020 code not found.")
    return {
        "parent": record,
        "children": catalog_service.get_children(code),
    }


@router.get("/controlled-vocabulary/{code}")
def controlled_vocabulary(request: Request, code: str):
    catalog_service = get_catalog(request)
    record = catalog_service.get(code)
    if record is None:
        raise HTTPException(status_code=404, detail="MSC 2020 code not found.")
    return get_vocabulary_service(request).lookup_for_msc(record)


@router.post("/bibliographies/generate")
def generate_bibliography(request: Request, payload: GenerateBibliographyRequest):
    catalog = get_catalog(request)

    if payload.target_scheme == "msc":
        record = catalog.get(payload.code or "")
        if record is None:
            raise HTTPException(status_code=404, detail="MSC 2020 code not found.")
        target_id = record.code
        target_label = record.title
        target_description = payload.description or record.description
    else:
        target_id = payload.label or ""
        target_label = payload.label or ""
        target_description = payload.description

    try:
        return get_bibliography_service(request).generate(
            target_scheme=payload.target_scheme,
            target_id=target_id,
            target_label=target_label,
            target_description=target_description,
            payload=payload,
        )
    except BibliographyGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/concepts/generate")
def generate_concepts(request: Request, payload: GenerateConceptTreeRequest):
    catalog = get_catalog(request)

    lineage: list[str] = []
    child_labels: list[str] = []
    if payload.target_scheme == "msc":
        record = catalog.get(payload.code or "")
        if record is None:
            raise HTTPException(status_code=404, detail="MSC 2020 code not found.")
        target_id = record.code
        target_label = record.title
        target_description = payload.description or record.description
        lineage = [f"{item.code} {item.title}" for item in record.lineage]
        child_labels = [child.title for child in catalog.get_children(record.code)]
    else:
        target_id = payload.label or ""
        target_label = payload.label or ""
        target_description = payload.description

    try:
        return get_concept_service(request).generate(
            target_id=target_id,
            target_label=target_label,
            target_scheme=payload.target_scheme,
            target_description=target_description,
            payload=payload,
            lineage=lineage,
            child_labels=child_labels,
        )
    except ConceptGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
