from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: str = "starter"

class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = "viewer"

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    tenant_id: UUID
    created_at: datetime
    tenant_slug: Optional[str] = None
    plan: Optional[str] = None
    avatar_url: Optional[str] = None
    notif_email_threats:  Optional[bool] = True
    notif_email_reports:  Optional[bool] = False
    notif_email_system:   Optional[bool] = True
    notif_browser_alerts: Optional[bool] = True
    class Config:
        from_attributes = True

class UserUpdateName(BaseModel):
    full_name: Optional[str] = None

class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str

class UserUpdateNotifications(BaseModel):
    email_threats:  Optional[bool] = None
    email_reports:  Optional[bool] = None
    email_system:   Optional[bool] = None
    browser_alerts: Optional[bool] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: str
    password: str
    tenant_slug: str

class DnsPolicyCreate(BaseModel):
    domain: str
    policy_type: str  # blacklist or whitelist
    category: str = "custom"

class DnsPolicyOut(BaseModel):
    id: UUID
    domain: str
    policy_type: str
    category: str
    created_at: datetime
    class Config:
        from_attributes = True

class DnsStats(BaseModel):
    total_queries: int
    blocked_today: int
    allowed_today: int
    top_blocked: List[dict]

class HealthOut(BaseModel):
    status: str
    version: str
    tenant_count: int
