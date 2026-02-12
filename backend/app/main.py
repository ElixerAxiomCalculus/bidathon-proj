from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.stock import router as stock_router
from app.routes.url import router as url_router
from app.routes.scraper import router as scraper_router
from app.routes.agent import router as agent_router
from app.routes.calc import router as calc_router
from app.routes.market import router as market_router

app = FastAPI(title="Bidathon API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock_router, prefix="/api")
app.include_router(url_router, prefix="/api")
app.include_router(scraper_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(market_router, prefix="/api")


@app.get("/")
def health_check():
    return {"status": "ok"}