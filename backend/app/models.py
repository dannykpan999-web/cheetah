import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(String(255), nullable=False)
    slug         = Column(String(100), unique=True, nullable=False)
    plan         = Column(String(50), default="starter")
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    users        = relationship("User",        back_populates="tenant")
    dns_policies = relationship("DnsPolicy",   back_populates="tenant")

class User(Base):
    __tablename__ = "users"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id       = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    email           = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(255))
    role            = Column(String(50), default="viewer")
    is_active       = Column(Boolean, default=True)
    avatar_url      = Column(String(255), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    tenant          = relationship("Tenant", back_populates="users")

class DnsPolicy(Base):
    __tablename__ = "dns_policies"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    domain      = Column(String(255), nullable=False)
    policy_type = Column(String(50), nullable=False)
    category    = Column(String(100), default="custom")
    created_at  = Column(DateTime, default=datetime.utcnow)
    tenant      = relationship("Tenant", back_populates="dns_policies")

class ScanResult(Base):
    __tablename__ = "scan_results"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id       = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    file_name       = Column(String(500), nullable=False)
    file_size       = Column(Integer, default=0)
    file_hash       = Column(String(64))
    mime_type       = Column(String(100))
    scan_status     = Column(String(50), default="pending")
    threats         = Column(Text, default="[]")
    risk_level      = Column(String(20), default="low")
    scan_engine     = Column(String(100), default="Cheetah Scanner v1.0")
    quarantined     = Column(Boolean, default=False)
    pii_detected    = Column(Boolean, default=False)
    pii_findings    = Column(Text, default="[]")   # JSON list of PII type strings
    timestamp_token = Column(Text)                  # RFC-3161-style DOCAS bridge token
    scanned_at      = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_log"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), nullable=True)
    user_id    = Column(UUID(as_uuid=True), nullable=True)
    action     = Column(String(255), nullable=False)
    resource   = Column(String(255))
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Phase 2: Endpoint Protection ──────────────────────────────────────────────

class Endpoint(Base):
    __tablename__ = "endpoints"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    agent_id       = Column(String(50))            # Wazuh agent ID e.g. "001"
    hostname       = Column(String(255), nullable=False)
    os_type        = Column(String(20))            # windows | macos | linux
    os_version     = Column(String(255))
    ip_address     = Column(String(45))
    status         = Column(String(20), default="never_connected")  # active | disconnected | never_connected
    agent_token    = Column(String(64), unique=True)
    sca_score      = Column(Integer, default=0)
    last_heartbeat = Column(DateTime)
    registered_at  = Column(DateTime, default=datetime.utcnow)
    alerts         = relationship("EndpointAlert",         back_populates="endpoint", cascade="all, delete-orphan")
    vulnerabilities = relationship("EndpointVulnerability", back_populates="endpoint", cascade="all, delete-orphan")

class EndpointAlert(Base):
    __tablename__ = "endpoint_alerts"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    endpoint_id = Column(UUID(as_uuid=True), ForeignKey("endpoints.id"), nullable=False)
    rule_id     = Column(String(20))
    severity    = Column(String(20))   # critical | high | medium | low
    category    = Column(String(50))   # fim | vulnerability | sca | intrusion
    description = Column(Text)
    resolved    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    endpoint    = relationship("Endpoint", back_populates="alerts")

class EndpointVulnerability(Base):
    __tablename__ = "endpoint_vulnerabilities"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    endpoint_id = Column(UUID(as_uuid=True), ForeignKey("endpoints.id"), nullable=False)
    cve_id      = Column(String(30))
    severity    = Column(String(20))   # critical | high | medium | low
    package     = Column(String(255))
    version     = Column(String(100))
    description = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)
    endpoint    = relationship("Endpoint", back_populates="vulnerabilities")
