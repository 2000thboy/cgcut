"""Acceptance Service (FastAPI)

Endpoints:
- POST /accept/review : run storyboard acceptance scoring
- POST /accept/reload : reload rules/synonyms from disk

Auth: Header Authorization: Bearer $ACCEPT_API_KEY (skip if not set)

Scoring (percent scale for similarity):
- coverage: blocks with acceptable match / total blocks
- similarity: avg min(1, similarity/100) across blocks (0 if no match)
- emotion: ratio of emotion-matched blocks (with synonym expansion)
- duration: ratio of blocks within tolerance |actual-expected|/expected <= duration_tolerance
Pass if coverage>=coverage_min and similarity>=sim_min_norm and emotion>=emotion_min and duration>=duration_min
"""

import json
import os
import hashlib
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


APP_ROOT = Path(__file__).parent
DEFAULT_RULES_PATH = APP_ROOT / "resources" / "rules.json"
DEFAULT_SYNONYM_PATH = APP_ROOT / "resources" / "emotion_synonyms.json"


app = FastAPI(title="Acceptance Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def verify_api_key(authorization: Optional[str] = Header(None)) -> str:
    expected = os.getenv("ACCEPT_API_KEY")
    if not expected:
        return "auth-disabled"
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="缺少 Authorization Bearer 头")
    token = authorization.split(" ", 1)[1]
    if token != expected:
        raise HTTPException(status_code=403, detail="无效的 API key")
    return token


def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return default


def normalize_emotion(emotion: Optional[str]) -> str:
    return (emotion or "").strip()


class StoryboardItem(BaseModel):
    scene_id: Optional[str] = None
    block_id: str
    text: str
    emotion: Optional[str] = None
    expected_duration: float = Field(0.0, description="期望时长(秒)")


class MatchItem(BaseModel):
    block_id: str
    shot_id: Optional[str] = None
    file_path: Optional[str] = None
    similarity: float = Field(..., description="相似度百分制 0-100")
    tags: List[str] = []
    emotion: Optional[str] = None
    duration: Optional[float] = None


class RuleSet(BaseModel):
    coverage_min: float = 0.9  # ratio
    similarity_min: float = 70  # percent
    emotion_match_min: float = 0.6  # ratio
    duration_tolerance: float = 0.2  # relative tolerance
    duration_pass_min: float = 0.8  # ratio of blocks within tolerance


class AcceptanceRequest(BaseModel):
    storyboard: List[StoryboardItem]
    matches: List[MatchItem]
    rules: Optional[RuleSet] = None
    kb_paths: Optional[List[str]] = None


class Score(BaseModel):
    coverage: float
    similarity: float
    emotion: float
    duration: float


class ItemResult(BaseModel):
    block_id: str
    status: str
    details: str


class AcceptanceResponse(BaseModel):
    passed: bool
    score: Score
    reasons: List[str]
    items: List[ItemResult]


class ConfigState:
    def __init__(self):
        self.rules = self._load_rules()
        self.emotion_synonyms = self._load_synonyms()

    def _load_rules(self) -> RuleSet:
        data = load_json(Path(os.getenv("RULES_PATH", DEFAULT_RULES_PATH)), {})
        return RuleSet(**data) if data else RuleSet()

    def _load_synonyms(self) -> Dict[str, List[str]]:
        return load_json(Path(os.getenv("EMOTION_SYNONYM_PATH", DEFAULT_SYNONYM_PATH)), {})

    def reload(self):
        self.rules = self._load_rules()
        self.emotion_synonyms = self._load_synonyms()


state = ConfigState()


def emotion_match(expected: str, actual: str, synonyms: Dict[str, List[str]]) -> bool:
    if not expected:
        return True
    if not actual:
        return False
    exp = normalize_emotion(expected)
    act = normalize_emotion(actual)
    if exp == act:
        return True
    alts = synonyms.get(exp, [])
    return act in alts


def evaluate(request: AcceptanceRequest) -> AcceptanceResponse:
    rules = request.rules or state.rules
    synonyms = state.emotion_synonyms or {}

    items: List[ItemResult] = []
    reasons: List[str] = []
    similarity_scores: List[float] = []
    emotion_hits: int = 0
    duration_hits: int = 0
    covered_blocks: int = 0

    match_by_block: Dict[str, List[MatchItem]] = {}
    for m in request.matches:
        match_by_block.setdefault(m.block_id, []).append(m)

    for sb in request.storyboard:
        block_matches = match_by_block.get(sb.block_id, [])
        if not block_matches:
            similarity_scores.append(0.0)
            items.append(ItemResult(block_id=sb.block_id, status="fail", details="no match"))
            continue

        best = max(block_matches, key=lambda m: m.similarity)
        sim_percent = best.similarity
        sim_norm = min(1.0, max(0.0, sim_percent / 100.0))
        similarity_scores.append(sim_norm)

        emo_ok = emotion_match(sb.emotion or "", best.emotion or "", synonyms)
        dur_ok = False
        if sb.expected_duration > 0 and best.duration is not None:
            delta = abs(best.duration - sb.expected_duration) / max(sb.expected_duration, 1e-6)
            dur_ok = delta <= rules.duration_tolerance
        else:
            dur_ok = True

        if emo_ok:
            emotion_hits += 1
        if dur_ok:
            duration_hits += 1

        passed_block = (
            sim_percent >= rules.similarity_min and emo_ok and dur_ok
        )
        if passed_block:
            covered_blocks += 1
            items.append(ItemResult(block_id=sb.block_id, status="pass", details="ok"))
        else:
            fail_reasons = []
            if sim_percent < rules.similarity_min:
                fail_reasons.append(f"similarity {sim_percent:.1f} < {rules.similarity_min}")
            if not emo_ok:
                fail_reasons.append("emotion mismatch")
            if not dur_ok:
                fail_reasons.append("duration mismatch")
            detail = "; ".join(fail_reasons)
            reasons.append(f"block {sb.block_id}: {detail}")
            items.append(ItemResult(block_id=sb.block_id, status="fail", details=detail))

    total_blocks = max(1, len(request.storyboard))
    coverage = covered_blocks / total_blocks
    similarity_avg = sum(similarity_scores) / total_blocks if similarity_scores else 0.0
    emotion_score = emotion_hits / total_blocks
    duration_score = duration_hits / total_blocks

    passed = (
        coverage >= rules.coverage_min
        and similarity_avg >= rules.similarity_min / 100.0
        and emotion_score >= rules.emotion_match_min
        and duration_score >= rules.duration_pass_min
    )

    if coverage < rules.coverage_min:
        reasons.append(f"coverage {coverage:.2f} < {rules.coverage_min}")
    if similarity_avg < rules.similarity_min / 100.0:
        reasons.append(
            f"similarity avg {similarity_avg*100:.1f}% < {rules.similarity_min}%"
        )
    if emotion_score < rules.emotion_match_min:
        reasons.append(
            f"emotion match {emotion_score:.2f} < {rules.emotion_match_min}"
        )
    if duration_score < rules.duration_pass_min:
        reasons.append(
            f"duration pass {duration_score:.2f} < {rules.duration_pass_min}"
        )

    return AcceptanceResponse(
        passed=passed,
        score=Score(
            coverage=round(coverage, 3),
            similarity=round(similarity_avg, 3),
            emotion=round(emotion_score, 3),
            duration=round(duration_score, 3),
        ),
        reasons=reasons,
        items=items,
    )


@app.post("/accept/review", response_model=AcceptanceResponse)
def review(request: AcceptanceRequest, api_key: str = Depends(verify_api_key)):
    return evaluate(request)


@app.post("/accept/reload")
def reload_config(api_key: str = Depends(verify_api_key)):
    state.reload()
    return {"status": "ok"}


@app.get("/accept/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9000")))
