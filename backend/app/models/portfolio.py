from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String, default="내 포트폴리오")
    is_paper = Column(Boolean, default=True)  # True=모의, False=실제
    broker = Column(String, nullable=True)  # alpaca, kis, manual 등
    cash_balance = Column(Float, default=0.0)
    currency = Column(String, default="USD")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    symbol = Column(String, nullable=False, index=True)
    market = Column(String, default="US")  # US, KR
    quantity = Column(Float, nullable=False)
    avg_cost = Column(Float, nullable=False)  # 평균 매수가
    currency = Column(String, default="USD")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)  # buy / sell
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    is_paper = Column(Boolean, default=True)
    broker_order_id = Column(String, nullable=True)
    status = Column(String, default="filled")  # pending, filled, cancelled
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    meta = Column(JSON, default=dict)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    symbol = Column(String, nullable=False)
    condition = Column(String, nullable=False)  # above, below, change_pct
    threshold = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
