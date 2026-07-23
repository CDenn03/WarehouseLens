from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse
from fastapi import HTTPException
from secrets import token_urlsafe
import httpx
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/login")
async def login(response: Response):
    settings = get_settings()
    state = token_urlsafe(32)

    response.set_cookie(
        "oauth_state", state,
        max_age=300, httponly=True, samesite="lax",
    )

    auth_url = (
        f"{settings.keycloak_issuer_url}/protocol/openid-connect/auth"
        f"?client_id={settings.keycloak_client_id}"
        f"&redirect_uri={settings.keycloak_redirect_uri}"
        f"&response_type=code"
        f"&scope=openid+profile+email"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)

@router.get("/callback")
async def callback(code: str, state: str, request: Request, response: Response):
    settings = get_settings()

    stored_state = request.cookies.get("oauth_state")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"{settings.keycloak_issuer_url}/protocol/openid-connect/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.keycloak_redirect_uri,
                "client_id": settings.keycloak_client_id,
                "client_secret": settings.keycloak_client_secret,
            },
        )
    token_resp.raise_for_status()
    tokens = token_resp.json()

    response.set_cookie(
        settings.cookie_name, tokens["access_token"],
        max_age=tokens.get("expires_in", settings.cookie_max_age),
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
    )

    response.delete_cookie("oauth_state")
    return RedirectResponse(url="/docs")

@router.get("/logout")
async def logout(response: Response):
    settings = get_settings()

    response.delete_cookie(settings.cookie_name)

    logout_url = (
        f"{settings.keycloak_issuer_url}/protocol/openid-connect/logout"
        f"?client_id={settings.keycloak_client_id}"
        f"&post_logout_redirect_uri={settings.keycloak_post_logout_redirect_uri}"
    )
    return RedirectResponse(url=logout_url)