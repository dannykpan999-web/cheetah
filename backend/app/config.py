from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cheetah:cheetah123@db:5432/cheetah"
    SECRET_KEY: str = "cheetah-super-secret-jwt-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ADGUARD_HOST: str = "http://adguard:3000"
    ADGUARD_USER: str = "admin"
    ADGUARD_PASS: str = "adguard123"
    # Resend — optional, email alerts sent only when configured
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM: str = "Cheetah Security <noreply@cheetah.technology>"
    # Anthropic — AI assistant
    ANTHROPIC_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
