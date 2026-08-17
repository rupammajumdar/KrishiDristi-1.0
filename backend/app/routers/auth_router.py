"""
KrishiDrishti AI — Auth Router
POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, UserRole, LanguageCode
from app.schemas import UserRegister, UserLogin, TokenResponse, UserResponse, UserUpdate
from app.auth import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    res = await db.execute(select(User).where(User.email == user_in.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        role=UserRole(user_in.role.value),
        language_pref=LanguageCode(user_in.language_pref.value),
        org_id=user_in.org_id
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token({"sub": str(new_user.id), "role": new_user.role.value})
    refresh_token = create_refresh_token({"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(login_in: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password."""
    res = await db.execute(select(User).where(User.email == login_in.email))
    user = res.scalar_one_or_none()
    
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile settings."""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.phone is not None:
        current_user.phone = user_update.phone
    if user_update.language_pref is not None:
        current_user.language_pref = LanguageCode(user_update.language_pref.value)
    if user_update.sms_opt_in is not None:
        current_user.sms_opt_in = user_update.sms_opt_in
    if user_update.email_opt_in is not None:
        current_user.email_opt_in = user_update.email_opt_in

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
