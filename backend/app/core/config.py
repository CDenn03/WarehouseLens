from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://wms:wms_dev_password@localhost:5432/wms"
    
    redis_url: str = "redis://localhost:6379/0"

    keycloak_issuer_url: str = "http://localhost:8080/realms/warehouselens"
    keycloak_client_id: str = "warehouselens-backend"
    keycloak_client_secret: str = ""
    keycloak_redirect_uri: str = "http://localhost:8000/api/v1/auth/callback"
    keycloak_post_logout_redirect_uri: str = "http://localhost:8000/docs"

    cookie_name: str = "access_token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_max_age: int = 3600

    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # Worker cadences (seconds). Analytics every 5 min, forecasts hourly — the guide
    # says 5-15 min is plenty for aggregation at this scale (Section 8).
    worker_aggregation_interval: int = 300
    worker_forecast_interval: int = 3600

    forecast_default_horizon_days: int = 28


@lru_cache
def get_settings() -> Settings:
    return Settings()
