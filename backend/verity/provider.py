"""Model boundary. No vendor API, checkpoint or training assumption lives in the app."""

import importlib
import os
from typing import Protocol

from .schemas import ProviderAssessment, RubricInput


class ProviderUnavailable(Exception):
    pass


class AssessmentProvider(Protocol):
    id: str
    mode: str  # model or fixture; returned on every assessment

    def assess(self, context: dict) -> ProviderAssessment: ...

    def draft_rubric(self, context: dict) -> RubricInput: ...


class UnconfiguredProvider:
    id = "not-configured"
    mode = "unconfigured"

    def assess(self, context):
        raise ProviderUnavailable("No assessment model configured")

    def draft_rubric(self, context):
        raise ProviderUnavailable("No rubric model configured")


def load_provider():
    factory_path = os.getenv("VERITY_PROVIDER_FACTORY")
    if not factory_path:
        return UnconfiguredProvider()
    module, factory = factory_path.split(":", 1)
    provider = getattr(importlib.import_module(module), factory)()
    if isinstance(provider, UnconfiguredProvider):
        return provider
    if provider.mode not in {"model", "fixture"} or not provider.id:
        raise ValueError("Provider must declare id and mode")
    return provider
