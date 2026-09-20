from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.crowd_report import CrowdReport
from app.models.favorite import Favorite
from app.models.moment import Moment
from app.models.review import Review
from app.models.user import Role, User
from app.rate_limit import auth_limiter, get_client_ip
from app.schemas.auth import (
    LoginRequest,
    MFALoginRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    PhoneLoginRequest,
    PhoneRegisterRequest,
    Token,
    UserCreate,
    UserOut,
    UserStats,
    UserUpdate,
)
from app.services.captcha import verify_turnstile_token
from app.services.firebase_auth import verify_firebase_id_token
from app.utils.security import (
    create_access_token,
    create_mfa_token,
    decode_mfa_token,
    dummy_verify_password,
    generate_totp_secret,
    get_totp_uri,
    hash_password,
    verify_password,
    verify_totp_code,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(request: Request, data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account."""
    existing = db.query(User).filter(User.email == data.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=data.name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=Role.USER,
        is_active=True,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/phone/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def phone_register(data: PhoneRegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account using a verified Firebase Phone OTP ID Token."""
    try:
        claims = verify_firebase_id_token(data.id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or unverified Firebase token: {str(exc)}",
        )

    phone_number = claims.get("phone_number")
    firebase_uid = claims.get("uid")

    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firebase token does not contain a verified phone number",
        )

    # Check if phone number is already registered
    existing_phone = db.query(User).filter(User.phone == phone_number).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone number is already registered. Please log in instead.",
        )

    # Assign email if provided or generate an internal phone identifier email
    if data.email:
        existing_email = db.query(User).filter(User.email == data.email.lower()).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already in use.",
            )
        assigned_email = data.email.lower()
    else:
        digits = "".join(ch for ch in phone_number if ch.isdigit())
        assigned_email = f"user_{digits}@phone.pujafinder"

    user = User(
        name=data.name.strip(),
        phone=phone_number,
        firebase_uid=firebase_uid,
        email=assigned_email,
        password_hash="FIREBASE_PHONE_AUTH",
        role=Role.USER,
        is_active=True,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token, token_type="bearer")


@router.post("/phone/login", response_model=Token)
def phone_login(data: PhoneLoginRequest, db: Session = Depends(get_db)):
    """Authenticate an existing user using a verified Firebase Phone OTP ID Token."""
    try:
        claims = verify_firebase_id_token(data.id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or unverified Firebase token: {str(exc)}",
        )

    phone_number = claims.get("phone_number")
    firebase_uid = claims.get("uid")

    if not phone_number and not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Firebase token claims",
        )

    user = None
    if phone_number:
        user = db.query(User).filter(User.phone == phone_number).first()
    if not user and firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this phone number. Please sign up first.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    # Link firebase_uid if missing
    if firebase_uid and not user.firebase_uid:
        user.firebase_uid = firebase_uid
        db.commit()

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token, token_type="bearer")


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    x_captcha_token: Optional[str] = Header(None, alias="X-Captcha-Token"),
):
    """Authenticate with email and password.

    Security hardening (OWASP Top 10):
    - Constant-time password evaluation to prevent username enumeration & timing attacks (WSTG-INFO-04).
    - Multi-Factor Authentication (MFA) challenge flow.
    - Cloudflare Turnstile bot verification (A04).
    - Per-IP and per-account brute-force rate limiting (A07).
    - Generic failure message "Invalid email or password" (A07).
    """
    client_ip = get_client_ip(request)

    # Parse request payload (supports JSON body or OAuth2 application/x-www-form-urlencoded)
    email: str = ""
    password: str = ""
    captcha_token = x_captcha_token

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            email = str(body.get("email") or body.get("username") or "").strip().lower()
            password = str(body.get("password") or "")
            if not captcha_token:
                captcha_token = body.get("captcha_token")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request payload")
    else:
        # Form data fallback
        form = await request.form()
        email = str(form.get("username") or form.get("email") or "").strip().lower()
        password = str(form.get("password") or "")
        if not captcha_token:
            captcha_token = form.get("captcha_token")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    # 1. Check Rate Limiting (Per-IP and Per-User brute-force prevention)
    ip_key = f"auth:ip:{client_ip}"
    user_key = f"auth:user:{email}"

    is_ip_blocked, ip_retry_after = await auth_limiter.is_blocked(ip_key)
    if is_ip_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {ip_retry_after} seconds.",
            headers={"Retry-After": str(ip_retry_after)},
        )

    is_user_blocked, user_retry_after = await auth_limiter.is_blocked(user_key)
    if is_user_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts for this account. Please try again in {user_retry_after} seconds.",
            headers={"Retry-After": str(user_retry_after)},
        )

    # 2. Verify Bot Protection (Cloudflare Turnstile)
    if not verify_turnstile_token(captcha_token, remote_ip=client_ip):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security challenge failed. Please complete the captcha and try again.",
        )

    # 3. Lookup user in DB
    user = db.query(User).filter(User.email == email).first()

    # 4. Constant-time password evaluation (Mitigating Timing Attacks)
    # If user doesn't exist, we execute dummy_verify_password to ensure bcrypt takes
    # the exact same execution time (~150-250ms) as an existing user.
    if user is not None:
        password_valid = verify_password(password, user.password_hash)
    else:
        dummy_verify_password(password)
        password_valid = False

    is_active = getattr(user, "is_active", True) if user else True

    # 5. Generic Error handling to prevent Username Enumeration (OWASP A07)
    if not user or not password_valid or not is_active:
        # Record failure for both IP and user
        await auth_limiter.record_failure(ip_key)
        await auth_limiter.record_failure(user_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authentication succeeded: reset rate limit counters
    await auth_limiter.reset(ip_key)
    await auth_limiter.reset(user_key)

    # 6. Check Multi-Factor Authentication (MFA)
    if getattr(user, "is_mfa_enabled", False):
        mfa_token = create_mfa_token(user_id=user.id)
        return Token(mfa_required=True, mfa_token=mfa_token)

    # Direct login if MFA is not enabled
    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, mfa_required=False)


@router.post("/login/mfa", response_model=Token)
async def login_mfa(
    request: Request,
    data: MFALoginRequest,
    db: Session = Depends(get_db),
):
    """Secondary authentication step: verify 6-digit TOTP code and issue access token."""
    client_ip = get_client_ip(request)
    ip_key = f"auth:mfa:ip:{client_ip}"

    # Rate limiting for MFA attempts (brute force protection against 6-digit codes)
    is_blocked, retry_after = await auth_limiter.is_blocked(ip_key)
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many invalid verification attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Validate temporary MFA session token
    user_id = decode_mfa_token(data.mfa_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA session expired or invalid. Please log in again.",
        )

    user = db.get(User, user_id)
    if not user or not user.is_active or not user.is_mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA state.")

    # Validate 6-digit TOTP code
    if not verify_totp_code(user.mfa_secret, data.code):
        await auth_limiter.record_failure(ip_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification code. Please check your authenticator app.",
        )

    # Reset limiter and issue access token
    await auth_limiter.reset(ip_key)
    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, mfa_required=False)


@router.post("/mfa/setup", response_model=MFASetupResponse)
def mfa_setup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new TOTP secret and setup URI for authenticator enrollment."""
    secret = generate_totp_secret()
    otpauth_url = get_totp_uri(secret, current_user.email)

    # Save pending secret in user record
    current_user.mfa_secret = secret
    db.commit()

    return MFASetupResponse(secret=secret, otpauth_url=otpauth_url)


@router.post("/mfa/enable", response_model=UserOut)
def mfa_enable(
    data: MFAVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm first TOTP code and permanently enable MFA for user account."""
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated.")

    if not verify_totp_code(current_user.mfa_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid verification code. Setup not verified.")

    current_user.is_mfa_enabled = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/mfa/disable", response_model=UserOut)
def mfa_disable(
    data: MFAVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable MFA after verifying current password and valid TOTP code."""
    if not data.current_password or not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if current_user.mfa_secret and not verify_totp_code(current_user.mfa_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    current_user.is_mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    db.refresh(current_user)
    return current_user



@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Get the currently logged-in user."""
    return current_user


@router.put("/profile", response_model=UserOut)
def update_profile(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (name and/or password)."""
    changed = False

    if data.name is not None:
        current_user.name = data.name.strip()
        changed = True

    if data.new_password is not None:
        if not data.current_password:
            raise HTTPException(
                status_code=400,
                detail="Current password is required to set a new password",
            )
        if not verify_password(data.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.password_hash = hash_password(data.new_password)
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="No changes provided")

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/stats", response_model=UserStats)
def user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get activity statistics for the currently logged-in user."""
    total_reviews = db.query(sa_func.count(Review.id)).filter(
        Review.user_id == current_user.id
    ).scalar() or 0

    total_crowd_reports = db.query(sa_func.count(CrowdReport.id)).filter(
        CrowdReport.user_id == current_user.id
    ).scalar() or 0

    total_favorites = db.query(sa_func.count(Favorite.id)).filter(
        Favorite.user_id == current_user.id
    ).scalar() or 0

    total_moments = db.query(sa_func.count(Moment.id)).filter(
        Moment.user_id == current_user.id
    ).scalar() or 0

    return UserStats(
        total_reviews=total_reviews,
        total_crowd_reports=total_crowd_reports,
        total_favorites=total_favorites,
        total_moments=total_moments,
        member_since=current_user.created_at,
        role=current_user.role,
    )
