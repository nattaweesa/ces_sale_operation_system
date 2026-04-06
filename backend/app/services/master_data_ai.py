from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class CanonicalSuggestion:
    text: str
    provider: str


class CanonicalDescriptionAIAdapter:
    """Swappable adapter for canonical description suggestion.

    v1 ships deterministic fallback so the module still works without external AI.
    """

    def suggest(self, draft_description: str) -> CanonicalSuggestion:
        cleaned = " ".join((draft_description or "").strip().split())
        cleaned = re.sub(r"\s+,", ",", cleaned)
        cleaned = re.sub(r"\s+\.", ".", cleaned)
        if not cleaned:
            return CanonicalSuggestion(text="", provider="deterministic-fallback")

        # Simple deterministic normalization to keep output stable.
        text = cleaned[0].upper() + cleaned[1:] if len(cleaned) > 1 else cleaned.upper()
        text = text.replace("  ", " ")
        return CanonicalSuggestion(text=text, provider="deterministic-fallback")


ai_adapter = CanonicalDescriptionAIAdapter()
