from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.books import router as books_router
from app.routes.users import router as users_router

app = FastAPI(title="Admin Livraria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(books_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
