from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.stock import router as stock_router
from app.routes.url import router as url_router
from app.routes.scraper import router as scraper_router
from app.routes.agent import router as agent_router
from app.routes.calc import router as calc_router
from app.routes.market import router as market_router
from app.routes.trading import router as trading_router
from app.quant.routes import router as quant_router
from app.quant.stream_router import router as quant_stream_router

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

def get_remote_address_no_options(request):
    if request.method == "OPTIONS":
        return None
    return get_remote_address(request)

limiter = Limiter(key_func=get_remote_address_no_options, default_limits=["60/minute"])
from starlette.requests import Request
from starlette.responses import JSONResponse

async def rate_limit_error_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": f"Rate limit exceeded: {exc.detail}"},
    )

app = FastAPI(title="FinAlly API", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda request, exc: JSONResponse(status_code=429, content={"error": f"Rate limit exceeded: {exc.detail}"}))

# 1. Add SlowAPI (Inner)
app.add_middleware(SlowAPIMiddleware)

# 2. Add Exception Catcher (Middle) - Wraps SlowAPI
@app.middleware("http")
async def catch_rate_limit_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except RateLimitExceeded as exc:
        return JSONResponse(
            status_code=429,
            content={"error": f"Rate limit exceeded: {exc.detail}"},
        )

# 3. Add CORS (Outer) - Wraps Catcher

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000","https://finallybidathon.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(stock_router, prefix="/api")
app.include_router(url_router, prefix="/api")
app.include_router(scraper_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(trading_router, prefix="/api")
app.include_router(quant_router, prefix="/api")
app.include_router(quant_stream_router, prefix="/api")


@app.get("/")
def health_check():
    return {"status": "ok", "version": "2.0.0"}
