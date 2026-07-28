"""The copilot's planner + tool router (Section 7).

Architecture rule this implements: the planner NEVER generates SQL. It picks a
tool via native tool-calling (agent-core-spec.md §2.1), the tool runs a fixed
parameterized query, the structured result comes back, and a second LLM call
turns that into prose. Graph shape: plan -> execute -> synthesize -> END, with
execute short-circuiting to a terminal answer on refusal or tool failure.
"""

from __future__ import annotations

import json
import logging
from typing import Any, TypedDict
from uuid import UUID

from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, StateGraph
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agent.tools import TOOL_REGISTRY
from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, UpstreamError, WarehouseLensError
from app.core.permissions.warehouse import WAREHOUSE_GLOBAL
from app.core.security import CurrentUser, assigned_warehouse_ids
from app.schemas.agent import AgentAnswer

logger = logging.getLogger(__name__)

REFUSAL_ANSWER = "I'm not able to show data for a warehouse you're not assigned to."
CLARIFY_ANSWER = (
    "I can't answer that from the tools I have — try asking about stock "
    "levels, suppliers, forecasts, or outbound status."
)

SYSTEM_PROMPT = (
    "You are WarehouseLens's operations copilot. You must answer strictly "
    "from the structured data you are given by a tool call — never invent "
    "numbers. Always call exactly one tool; if none of the available tools "
    "fit the question, do not call a tool at all."
)

SYNTHESIS_PROMPT = (
    "Answer the user's question using ONLY the JSON data below. Be concise "
    "and concrete — include the actual numbers/names asked for. If the data "
    "doesn't contain the answer, say you don't have that information; never "
    "guess.\n\nQuestion: {question}\n\nData:\n{data}"
)


class AgentState(TypedDict, total=False):
    question: str
    warehouse_id: str | None
    user: CurrentUser
    db: Session
    tool_name: str | None
    tool_args: dict[str, Any] | None
    tool_result: dict | None
    tool_used: str | None
    answer: str | None


# Native tool-calling maps a call back to us by the Pydantic input model's
# class name (LangChain's default tool name), not the registry's short key.
_NAME_BY_SCHEMA = {input_model.__name__: name for name, (input_model, _) in TOOL_REGISTRY.items()}


def _llm(temperature: float = 0.0) -> ChatAnthropic:
    settings = get_settings()
    return ChatAnthropic(model=settings.llm_model, api_key=settings.llm_api_key, temperature=temperature)


def _is_global(user: CurrentUser) -> bool:
    return WAREHOUSE_GLOBAL in user.permissions


def plan_node(state: AgentState) -> AgentState:
    """One LLM call, schema-constrained via bind_tools: the model either picks
    exactly one tool + args, or calls none (routed to `clarify` downstream)."""
    llm = _llm().bind_tools([input_model for input_model, _ in TOOL_REGISTRY.values()])
    try:
        response = llm.invoke([("system", SYSTEM_PROMPT), ("human", state["question"])])
    except Exception as exc:  # noqa: BLE001 — any transport/auth failure is an upstream dependency failure
        raise UpstreamError(f"LLM plan call failed: {exc}") from exc

    calls = getattr(response, "tool_calls", None) or []
    if not calls:
        return {**state, "tool_name": None, "tool_args": None}

    call = calls[0]
    tool_name = _NAME_BY_SCHEMA.get(call["name"])
    return {**state, "tool_name": tool_name, "tool_args": dict(call.get("args") or {})}


def execute_node(state: AgentState) -> AgentState:
    """Pure Python — no LLM here. Validates args, injects scope, calls the
    tool. Never trusts the planner's own warehouse_id (Section 9): a
    scope-violating tool call raises ForbiddenError from inside the tool
    itself (defense in depth), which this node turns into a terminal refusal
    rather than letting it bubble as a 500/403 mid-graph."""
    tool_name = state.get("tool_name")
    if tool_name is None or tool_name not in TOOL_REGISTRY:
        return {**state, "tool_result": None}

    input_model, tool_fn = TOOL_REGISTRY[tool_name]
    args = dict(state.get("tool_args") or {})
    user = state["user"]
    db = state["db"]

    if "warehouse_id" in input_model.model_fields:
        requested = state.get("warehouse_id")
        if requested is not None:
            # /agent/query already scope-checked this one — force it,
            # regardless of what the LLM put in the tool call.
            args["warehouse_id"] = requested
        elif not _is_global(user):
            assigned = assigned_warehouse_ids(db, user)
            if len(assigned) == 1:
                args["warehouse_id"] = str(next(iter(assigned)))
            # Otherwise leave whatever the planner supplied — each tool's own
            # resolve_scoped_warehouse_ids() narrows to the caller's visible
            # set regardless, so a stale/foreign id here can't leak data.

    try:
        validated = input_model(**args)
    except ValidationError:
        # A planner mistake, not a real tool invocation — tool_used stays
        # unset so eval/run_eval.py doesn't count this as execution success.
        logger.info("planner produced invalid args for %s: %r", tool_name, args)
        return {**state, "tool_result": None}

    try:
        result = tool_fn(validated, db, user)
    except ForbiddenError:
        return {**state, "tool_used": tool_name, "tool_result": None, "answer": REFUSAL_ANSWER}
    except WarehouseLensError as exc:
        return {
            **state,
            "tool_used": tool_name,
            "tool_result": None,
            "answer": f"I couldn't complete that: {exc.detail}",
        }

    return {**state, "tool_used": tool_name, "tool_result": result}


def synthesize_node(state: AgentState) -> AgentState:
    """Second LLM call: question + structured tool_result -> prose. Skipped
    entirely if execute already produced a terminal answer (refusal/error) or
    no tool was called at all (clarify)."""
    if state.get("answer") is not None:
        return state
    if state.get("tool_result") is None:
        return {**state, "answer": CLARIFY_ANSWER}

    prompt = SYNTHESIS_PROMPT.format(
        question=state["question"], data=json.dumps(state["tool_result"], default=str)
    )
    try:
        response = _llm().invoke(prompt)
    except Exception as exc:  # noqa: BLE001
        raise UpstreamError(f"LLM synthesize call failed: {exc}") from exc

    return {**state, "answer": response.content}


_AGENT_APP = None


def _build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("plan", plan_node)
    graph.add_node("execute", execute_node)
    graph.add_node("synthesize", synthesize_node)
    graph.set_entry_point("plan")
    graph.add_edge("plan", "execute")
    graph.add_edge("execute", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


def _get_agent_app():
    global _AGENT_APP
    if _AGENT_APP is None:
        _AGENT_APP = _build_graph()
    return _AGENT_APP


def run_agent(
    db: Session, user: CurrentUser, question: str, warehouse_id: UUID | None
) -> AgentAnswer:
    """Entry point called by POST /agent/query. The scope gate for an
    explicit warehouse_id already ran there (Section 9) before this is
    invoked — this function only builds/reuses the compiled graph and
    threads the request through it."""
    app = _get_agent_app()
    initial: AgentState = {
        "question": question,
        "warehouse_id": str(warehouse_id) if warehouse_id else None,
        "user": user,
        "db": db,
        "tool_name": None,
        "tool_args": None,
        "tool_result": None,
        "tool_used": None,
        "answer": None,
    }
    final = app.invoke(initial)
    return AgentAnswer(
        answer=final.get("answer") or CLARIFY_ANSWER,
        tool_used=final.get("tool_used"),
        data=final.get("tool_result"),
    )
