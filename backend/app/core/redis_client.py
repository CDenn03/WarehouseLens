"""Redis wrapper.

LEARNING AREA — Redis. Real method signatures, no-op bodies. The app imports and
calls this today without crashing; wiring it to a real `redis.Redis` client is the
learning exercise. Uses in this codebase (grep for `RedisClient` to find call sites):

  - worker.py: distributed lock so two worker replicas don't run the same
    aggregation tick, plus a `last_run` timestamp for observability.
  - dashboard endpoints: short-TTL cache for KPI payloads.
  - agent: (optional) per-user rate limit on /agent/query.

TODO(learning): Key-naming decision. Pick a scheme and stick to it — flat prefixes
(`wl:kpis:{warehouse_id}`) are greppable and simple; hash-per-domain
(`HSET wl:kpis <warehouse_id> <json>`) groups related values and allows one TTL for
the group but per-field TTLs don't exist. Flat string keys with `wl:` prefix is the
conventional default; note WHY before choosing the fancier option.

TODO(learning): Client choice. `redis-py` sync client is fine for the worker; the
FastAPI request path wants `redis.asyncio`. Options: (a) one async client everywhere,
worker wraps calls with asyncio.run — awkward; (b) sync in worker + async in API —
two clients, simple; (c) skip caching in the API entirely at this scale. (b) is the
usual answer; (c) is honest.
"""

from app.core.config import get_settings


class RedisClient:
    def __init__(self, url: str | None = None):
        self.url = url or get_settings().redis_url
        # TODO(learning): create the real client here, e.g.
        #   self._r = redis.Redis.from_url(self.url, decode_responses=True)
        # decode_responses=True saves you from bytes-vs-str bugs; the cost is you
        # can't store raw binary. Fine here — everything we cache is JSON.
        self._r = None

    def get(self, key: str) -> str | None:
        # TODO(learning): return self._r.get(key)
        return None

    def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        # TODO(learning): self._r.set(key, value, ex=ttl_seconds)
        # `ex=` is the idiomatic way to set a TTL atomically with the write —
        # a separate EXPIRE call leaves a window where the key lives forever.
        return None

    def delete(self, key: str) -> None:
        # TODO(learning): self._r.delete(key)
        return None

    def acquire_lock(self, name: str, ttl_seconds: int = 60) -> bool:
        """Best-effort distributed lock for the worker (SET NX EX).

        TODO(learning): return bool(self._r.set(f"wl:lock:{name}", "1", nx=True, ex=ttl_seconds))
        Why NX+EX and not SETNX+EXPIRE: two commands aren't atomic — if the worker
        dies between them the lock never expires and aggregation stops forever.
        Returning True (stub) means a single local worker always proceeds.
        """
        return True

    def release_lock(self, name: str) -> None:
        # TODO(learning): self._r.delete(f"wl:lock:{name}")
        # Strictly-correct release checks a fencing token (Lua script) so you never
        # delete a lock someone else re-acquired after your TTL lapsed. At this
        # project's scale, delete-by-name is acceptable — know the difference.
        return None


redis_client = RedisClient()
