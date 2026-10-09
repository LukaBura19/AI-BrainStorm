from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import List, Literal


class Settings(BaseSettings):
    # ---- App ----
    APP_TITLE: str = "BrainStorm Booking API"
    APP_VERSION: str = "0.1.0"
    APP_TIMEZONE: str = "Europe/Belgrade"

    # ---- Database ----
    DATABASE_URL: str = "postgresql://brainstorm:brainstorm_local@postgres:5432/brainstorm_booking"

    # ---- Auth ----
    SECRET_KEY: str = "change-me-to-a-random-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ---- CORS ----
    BACKEND_CORS_ORIGINS: str = "http://localhost:5174"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

    # ---- Frontend URL (za linkove u emailovima) ----
    FRONTEND_URL: str = "http://localhost:5174"

    # ---- Email ----
    MAIL_SERVER: str = "mailhog"
    MAIL_PORT: int = 1025
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@brainstorm.com"
    MAIL_TLS: bool = False
    MAIL_SSL: bool = False
    MAIL_ENABLED: bool = True
    MAIL_TIMEOUT_SECONDS: float = 10.0
    MAIL_DELIVERY_MODE: Literal["smtp", "capture"] = "smtp"

    @property
    def mail_is_capture(self) -> bool:
        """MailHog/Mailpit accept SMTP without delivering to real recipients."""
        host = self.MAIL_SERVER.strip().lower().rstrip(".")
        return self.MAIL_DELIVERY_MODE == "capture" or host.split(".")[0] in {"mailhog", "mailpit"}

    # ---- Uploadi (prilozi uz rezervacije) ----
    UPLOAD_DIR: str = "/app/uploads/booking_attachments"
    MAX_ATTACHMENT_BYTES: int = 25 * 1024 * 1024  # po fajlu
    MAX_BOOKING_ATTACHMENTS: int = 10  # ukupno po rezervaciji

    # ---- AI asistent uz snimke predavanja (Claude API) ----
    # Bez ključa stranice sa snimcima rade, a asistent javlja da nije podešen.
    ANTHROPIC_API_KEY: str = ""
    CHAT_MODEL: str = "claude-opus-5-5"
    CHAT_EFFORT: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    CHAT_MAX_TOKENS: int = 16000
    # Zaštita troškova: najviše CHAT_RATE_LIMIT poruka sa jedne IP adrese u CHAT_RATE_WINDOW_SECONDS sekundi.
    CHAT_RATE_LIMIT: int = 30
    CHAT_RATE_WINDOW_SECONDS: int = 600

    # ---- Zaštićeni snimci (VdoCipher DRM) ----
    # Tajni API ključ iz VdoCipher kontrolne table (Config → API Keys); nikad ne ide u pregledač.
    # Bez ključa snimci sa vdocipher_id javljaju da trenutno nisu dostupni.
    VDOCIPHER_API_SECRET: str = ""

    # ---- Admin seed ----
    ADMIN_EMAIL: str = "admin@brainstorm.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_FULL_NAME: str = "Admin BrainStorm"

    @model_validator(mode="after")
    def validate_mail_transport(self):
        if self.MAIL_TLS and self.MAIL_SSL:
            raise ValueError("MAIL_TLS i MAIL_SSL ne mogu istovremeno biti uključeni.")
        if self.MAIL_ENABLED and bool(self.MAIL_USERNAME) != bool(self.MAIL_PASSWORD):
            raise ValueError("MAIL_USERNAME i MAIL_PASSWORD moraju biti podešeni zajedno.")
        # Gmail prikazuje lozinku za aplikacije u grupama ("abcd efgh ijkl mnop"); razmaci nisu deo lozinke.
        if self.uses_gmail:
            self.MAIL_PASSWORD = "".join(self.MAIL_PASSWORD.split())
        return self

    @property
    def uses_gmail(self) -> bool:
        return self.MAIL_SERVER.strip().lower().rstrip(".") == "smtp.gmail.com"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "hide_input_in_errors": True,
    }


settings = Settings()
