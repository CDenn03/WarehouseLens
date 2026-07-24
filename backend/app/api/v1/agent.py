from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.planner import run_agent
from app.core.database import get_db
from app.core.security import CurrentUser, enforce_warehouse_scope, require_permission
from app.schemas.agent import AgentAnswer, AgentQuery

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query", response_model=AgentAnswer)
def query(
    body: AgentQuery,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission("agent.invoke")),
):
    """The copilot endpoint.

    The scope gate runs HERE, before the planner ever sees the question — the
    agent must never answer with data the caller couldn't query directly
    (Section 9). A second check runs inside each tool (defense in depth).
    """
    if body.warehouse_id is not None:
        enforce_warehouse_scope(db, user, body.warehouse_id)
    return run_agent(db=db, user=user, question=body.question, warehouse_id=body.warehouse_id)
