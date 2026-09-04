import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Boolean, DateTime, BigInteger, Integer, 
    Enum as SQLEnum, ForeignKey, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class ExtractionType(str, enum.Enum):
    DIRECT_TEXT = "DIRECT_TEXT"
    WEB_SCRAPING = "WEB_SCRAPING"

class MailProvider(str, enum.Enum):
    GMAIL = "GMAIL"
    OUTLOOK = "OUTLOOK"
    GENERIC_IMAP = "GENERIC_IMAP"

class AuthType(str, enum.Enum):
    OAUTH2 = "OAUTH2"
    APP_PASSWORD = "APP_PASSWORD"
    BASIC_IMAP = "BASIC_IMAP"

class LogStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    RATE_LIMITED = "RATE_LIMITED"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    logs = relationship("ExtractionLog", back_populates="user", cascade="all, delete-orphan")

class StreamingPlatform(Base):
    __tablename__ = "streaming_platforms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    extraction_type = Column(SQLEnum(ExtractionType), nullable=False, default=ExtractionType.DIRECT_TEXT)
    sender_email = Column(String(255), nullable=False)
    subject_filter = Column(String(255), nullable=True)
    code_regex_pattern = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    logs = relationship("ExtractionLog", back_populates="platform")

class MailAccount(Base):
    __tablename__ = "mail_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    provider = Column(SQLEnum(MailProvider), nullable=False, default=MailProvider.GENERIC_IMAP)
    auth_type = Column(SQLEnum(AuthType), nullable=False, default=AuthType.APP_PASSWORD)
    encrypted_credentials = Column(Text, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    imap_server = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True, default=993)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ExtractionLog(Base):
    __tablename__ = "extraction_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    platform_id = Column(Integer, ForeignKey("streaming_platforms.id"), nullable=False)
    queried_email = Column(String(255), nullable=False)
    status = Column(SQLEnum(LogStatus), nullable=False)
    extracted_code = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="logs")
    platform = relationship("StreamingPlatform", back_populates="logs")
