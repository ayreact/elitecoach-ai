import os
import httpx
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

# Fix Bug 4: URL loaded from env var so it can differ between local/staging/production
# without a code redeploy.
IDENTITY_SERVICE_URL = os.getenv(
    "IDENTITY_SERVICE_URL"
)

security = HTTPBearer()

async def validate_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Extracts the Bearer JWT from headers and makes an async HTTP GET request to
    the Identity Service (Service A) to validate the token.
    Returns the user data dict if successful, raises 401/502 otherwise.
    """
    token = credentials.credentials


    try:
        # Normalize the URL just in case the env var is missing the /api/ prefix
        target_url = IDENTITY_SERVICE_URL
        if "/v1/users" in target_url and "/api/v1" not in target_url:
            target_url = target_url.replace("/v1/users", "/api/v1/users")
            
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                target_url,
                headers={"Authorization": f"Bearer {token}"}
            )

            if response.status_code == 200:
                raw_data = response.json()
                # Map the Identity Service response to what Service D expects
                user_data = {}
                
                # Check for 'userId' (new format) or fallback to 'id'
                if "userId" in raw_data:
                    user_data["id"] = raw_data["userId"]
                elif "id" in raw_data:
                    user_data["id"] = raw_data["id"]
                else:
                    logger.error(f"Identity service returned malformed data: {raw_data}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token payload from identity service",
                    )
                
                # Map other fields
                user_data["email"] = raw_data.get("email")
                user_data["name"] = f"{raw_data.get('firstName', '')} {raw_data.get('lastName', '')}".strip()
                user_data["token"] = token # Store the token for reuse
                
                return user_data
            elif response.status_code in (401, 403):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                logger.error(f"Identity service returned unexpected status: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Error communicating with Identity Service",
                )
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Identity service: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Identity service is unavailable",
        )
