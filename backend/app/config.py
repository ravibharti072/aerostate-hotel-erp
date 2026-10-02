from pathlib import Path

from pydantic_settings import BaseSettings

# Anchor the default SQLite file to the backend/ directory rather than the
# process working directory. Previously this was "sqlite:///./hotel_erp.db",
# which silently resolved to a *different* database depending on where
# uvicorn was launched from - the cause of the repo-root vs backend/ DB drift.
BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "hotel_erp.db"


class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    SECRET_KEY: str = "hotel_erp_secret_key_change_later"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"


settings = Settings()