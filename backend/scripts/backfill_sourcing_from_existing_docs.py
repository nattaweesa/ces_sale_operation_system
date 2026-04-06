from __future__ import annotations

import asyncio

from app.database import AsyncSessionLocal
from app.services.sourcing_service import backfill_from_existing_documents


async def main() -> None:
    async with AsyncSessionLocal() as db:
        stats = await backfill_from_existing_documents(db)
        print("Backfill completed")
        for key, val in stats.items():
            print(f"- {key}: {val}")


if __name__ == "__main__":
    asyncio.run(main())
