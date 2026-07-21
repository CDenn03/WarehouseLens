"""Report Synthesis tool (stretch) — combines other tools into a narrative
summary. Example: "Summarize this week's warehouse performance."

LEARNING AREA — scaffold. Build this LAST, after the single-tool loop works.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class ReportSynthesisInput(BaseModel):
    warehouse_id: str | None = None
    period_days: int = 7


def report_synthesis_tool(input: ReportSynthesisInput, db: Session, user: CurrentUser) -> dict:
    """TODO(learning): this tool is different in kind — it doesn't run its own
    query; it fans out to the other tools and collects their structured outputs
    into one bundle for a single synthesis pass.

    Two architectures, pick one:
      (a) Tool-calls-tools: this function directly invokes the other tool
          functions (they're plain Python) and returns the merged dict. Simple,
          deterministic, no extra LLM calls — but the tool hardcodes WHICH
          sections a "report" has.
      (b) Planner-loops: the planner's graph gains a cycle (execute → plan) and
          the LLM decides which tools to call, accumulating results in state
          until it has enough. Flexible, and it's the actual "agentic loop"
          pattern — but now report quality depends on planning quality.
    (a) is the honest stretch-goal implementation for this term; (b) is the
    interesting follow-on. Either way the scope rule holds: every sub-call gets
    the same user and re-checks warehouse scope.
    """
    return {"sections": [], "note": "report_synthesis is a learning scaffold — not implemented"}
