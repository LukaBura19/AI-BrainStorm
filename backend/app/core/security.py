from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --------------- Password hashing ---------------

def hash_password(password: str) -> str:
    """Hashuje lozinku za cuvanje u bazi."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Proverava da li plain lozinka odgovara hash-u."""
    return pwd_context.verify(plain_password, hashed_password)


# --------------- JWT tokens ---------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Kreira JWT access token sa opcionalnim trajanjem."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Dekodira JWT token. Vraca payload ili None ako je nevazeci."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
