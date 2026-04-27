from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import httpx
import os

# Default Identity Service URL. When your co-developer sets up the Identity Service, 
# you can point this to their local server (e.g. http://localhost:8001) or their deployed service.
IDENTITY_SERVICE_URL = os.getenv("IDENTITY_SERVICE_URL", "http://localhost:8001")

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the bearer token by making an HTTP call to the external Identity Service.
    """
    authorization = f"Bearer {credentials.credentials}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{IDENTITY_SERVICE_URL}/api/v1/users/profile", # Defined via Microservice Architecture pattern
                headers={"Authorization": authorization},
                timeout=5.0
            )
            
            if response.status_code == 200:
                user_data = response.json()
                
                if "userType" in user_data:
                    user_data["role"] = user_data["userType"].title()
                    
                return user_data
            elif response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token rejected or expired according to Identity Service",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Identity Service responded with an unexpected status: {response.status_code}"
                )
    except httpx.RequestError as exc:
        print(f"Network error while calling Identity Service: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach the Identity Service. Please ensure it is running."
        )