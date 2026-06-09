from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        columns = await conn.exec_driver_sql("PRAGMA table_info(users)")
        existing = {row[1] for row in columns.fetchall()}
        missing_columns = {
            "settings": "ALTER TABLE users ADD COLUMN settings JSON",
            "layout_config": "ALTER TABLE users ADD COLUMN layout_config JSON",
            "watchlist": "ALTER TABLE users ADD COLUMN watchlist JSON",
            "api_keys_encrypted": "ALTER TABLE users ADD COLUMN api_keys_encrypted TEXT",
        }
        for column, statement in missing_columns.items():
            if column not in existing:
                await conn.exec_driver_sql(statement)
