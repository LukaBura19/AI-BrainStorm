import logging
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

# ---- Logging setup ----
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("brainstorm")

# ---- Routers ----
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.teacher import router as teacher_router
from app.api.public import router as public_router
from app.api.student import router as student_router
from app.api.prep import router as prep_router
from app.api.careers import router as careers_router

app = FastAPI(
    title=settings.APP_TITLE,
    description="API za zakazivanje casova u Edukativnom Centru BrainStorm",
    version=settings.APP_VERSION,
)

# ---- Global Error Handler ----
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Interna greška servera. Naš tim je obavešten."},
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Register routers ----
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(teacher_router)
app.include_router(public_router)
app.include_router(student_router)
app.include_router(prep_router)
app.include_router(careers_router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Healthcheck endpoint — proverava da API radi i da je baza dostupna."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Healthcheck: baza nije dostupna")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "brainstorm-booking-api",
                "database": "error",
            },
        )

    return {"status": "ok", "service": "brainstorm-booking-api", "database": "ok"}
