from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import Role


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    """Payload for updating the current user's profile."""
    name: str | None = Field(None, min_length=2, max_length=120)
    current_password: str | None = Field(None, min_length=6, max_length=128)
    new_password: str | None = Field(None, min_length=6, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    role: Role
    is_active: bool = True
    is_mfa_enabled: bool = False
    created_at: datetime | None = None


class PhoneRegisterRequest(BaseModel):
    """Payload for registering an account using a verified Firebase Phone OTP ID Token."""
    id_token: str
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None


class PhoneLoginRequest(BaseModel):
    """Payload for logging in using a verified Firebase Phone OTP ID Token."""
    id_token: str


class UserStats(BaseModel):
    """Activity statistics for the current user."""
    total_reviews: int = 0
    total_crowd_reports: int = 0
    total_favorites: int = 0
    total_moments: int = 0
    member_since: datetime | None = None
    role: Role = Role.USER


class Token(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: str | None = None


class LoginRequest(BaseModel):
    """Standard JSON login payload supporting CAPTCHA verification."""
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    captcha_token: str | None = None


class MFALoginRequest(BaseModel):
    """Payload to complete MFA step in authentication."""
    mfa_token: str
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class MFASetupResponse(BaseModel):
    """Response containing TOTP secret and QR code URI for authenticator enrollment."""
    secret: str
    otpauth_url: str


class MFAVerifyRequest(BaseModel):
    """Payload to verify TOTP during enrollment or deactivation."""
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    current_password: str | None = None


class ForgotPasswordRequest(BaseModel):
    """Payload to initiate password reset via email."""
    email: EmailStr
    captcha_token: str | None = None


class ResetPasswordRequest(BaseModel):
    """Payload to finalize password reset using signed token."""
    token: str
    new_password: str = Field(min_length=6, max_length=128)


