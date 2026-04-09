from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.app_name = "MSC Mathematics Atlas API"
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()
        self.crossref_mailto = os.getenv("CROSSREF_MAILTO", "").strip()
        self.openalex_email = os.getenv("OPENALEX_EMAIL", "").strip()
        raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
