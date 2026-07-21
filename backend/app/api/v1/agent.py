from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.planner import run_agent
from app.core.database import get_db
from app.core.security import CurrentUser, enforce_warehouse_scope, get_current_user
from app.schemas.agent import AgentAnswer, AgentQuery

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query", response_model=AgentAnswer)
def query(
    body: AgentQuery,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """The copilot endpoint.

    The scope gate runs HERE, before the planner ever sees the question — the
    agent must never answer with data the caller couldn't query directly
    (Section 9). A second check runs inside each tool (defense in depth).

    LEARNING AREA — the orchestration behind run_agent is scaffold-only; see
    app/agent/planner.py for the TODO(learning) map of what goes where.
    """
    if body.warehouse_id is not None:
        enforce_warehouse_scope(db, user, body.warehouse_id)
    # NOTE(redis): a per-user rate limit (INCR + EXPIRE on wl:ratelimit:{sub})
    # would slot in here — see app/core/redis_client.py TODOs.
    return run_agent(db=db, user=user, question=body.question, warehouse_id=body.warehouse_id)
