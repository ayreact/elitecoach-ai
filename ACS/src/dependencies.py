import httpx
from fastapi import Request, HTTPException, status
import logging

logger = logging.getLogger(__name__)

# Core gateway validation
async def validate_user(request: Request):
    """
    Extracts the Bearer JWT from headers and securely makes an asynchronous
    HTTP GET request to the Identity Service (Service A) to validate.
    Returns the user data dict if successful, raises 401/502 otherwise.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_header.split(" ")[1]
    identity_url = "https://api.elitecoach.ai/v1/identity/users/me"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                identity_url,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                user_data = response.json()
                # Must contain at minimum 'id' depending on Service A contract
                if "id" not in user_data:
                    logger.error(f"Identity service returned malformed data: {user_data}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token payload from identity service",
                    )
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
