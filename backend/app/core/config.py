from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str = "postgresql+psycopg://wms:wms_dev_password@localhost:5432/wms"

    redis_url: str = "redis://localhost:6379/0"

    keycloak_issuer_url: str = "http://localhost:8080/realms/warehouselens"
    # Internal URL used to fetch JWKS when the backend runs inside Docker
    # (where "localhost" doesn't reach Keycloak). Defaults to keycloak_issuer_url.
    keycloak_internal_url: str = ""
    keycloak_client_id: str = "warehouselens-backend"

    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # Worker cadences (seconds). Analytics every 5 min, forecasts hourly.
    worker_aggregation_interval: int = 300
    worker_forecast_interval: int = 3600

    forecast_default_horizon_days: int = 28

    # Bootstrap emails — read at migration time to seed the default tenant's
    # first admin and the platform pseudo-tenant's first platform admin.
    # Both can be overridden at runtime via environment variable or .env file.
    default_tenant_superuser_email: str = "admin@warehouselens.local"
    platform_admin_email: str = "platform@warehouselens.local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
