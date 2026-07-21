"""The copilot's planner + tool router.

LEARNING AREA — AI/agent. This file is a scaffold: the graph shape, state type,
and entry point are real; the planning logic is TODO. The architecture rule it
must implement (Section 7): the planner NEVER generates SQL. It picks a tool,
the tool runs a fixed parameterized query, the structured result comes back,
and the LLM turns that into prose.

TODO(learning): The LangGraph build, node by node:

  1. State. A TypedDict flowing through the graph:
       {question, warehouse_id, user, tool_name, tool_args, tool_result, answer}

  2. `plan` node. One LLM call that maps the question to (tool_name, tool_args).
     Decision to make — three ways to do this, in increasing ceremony:
       (a) Prompt the LLM to emit JSON ({"tool": ..., "args": {...}}) and parse it.
           Simple, but you own the parsing failures.
       (b) Native tool-calling: bind each tool's Pydantic input schema via
           `llm.bind_tools([...])` and let the API pick. Structured by
           construction; the model provider does the schema-constrained decoding.
       (c) LangGraph's prebuilt `create_react_agent`, which also loops
           (tool → observe → maybe another tool). Most capable, least visible —
           bad for learning first, fine to migrate to later.
     Start with (b): you keep the explicit graph but stop hand-parsing JSON.

  3. `execute` node. Look up tool_name in TOOL_REGISTRY, validate tool_args with
     the tool's input model, INJECT warehouse scope (see below), call it with the
     db session. Pure Python — no LLM here.

  4. `synthesize` node. Second LLM call: question + structured tool_result →
     prose answer. Tell it to answer ONLY from the data; "I don't know" beats
     hallucinated numbers — the eval harness (eval/run_eval.py) scores this.

  5. Edges: plan → execute → synthesize → END. Conditional edge from plan to a
     `clarify`/fallback node when no tool fits. Report Synthesis (stretch) turns
     execute→synthesize into a loop over several tools before one final synthesis.

  6. Scope enforcement (Section 9) — the part that must NOT be left to the LLM:
     /agent/query already gate-checked the requested warehouse_id. Here, force
     tool_args.warehouse_id to the request's warehouse_id for scoped roles (never
     trust the planner's own value — prompt injection via the question could set
     someone else's warehouse), and each tool re-checks via enforce_warehouse_scope.

The LLM client: langchain-anthropic's ChatAnthropic(model=settings.llm_model,
api_key=settings.llm_api_key). Keep temperature at 0 for the plan node.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.agent.tools import TOOL_REGISTRY
from app.core.security import CurrentUser
from app.schemas.agent import AgentAnswer


def run_agent(
    db: Session, user: CurrentUser, question: str, warehouse_id: UUID | None
) -> AgentAnswer:
    """Entry point called by POST /agent/query.

    TODO(learning): replace the canned response with: build the LangGraph app
    (module-level, compiled once), invoke it with the initial state, return the
    final state's answer + tool trace. The registry import above is live — the
    graph's execute node should be the only caller of those tool functions.
    """
    available = ", ".join(sorted(TOOL_REGISTRY))
    return AgentAnswer(
        answer=(
            "[agent scaffold] I can't reason about this yet — the planner is a "
            f"learning TODO. Question received: {question!r}. "
            f"Tools registered and ready to route to: {available}."
        ),
        tool_used=None,
        data=None,
    )
