from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# Security
security = HTTPBearer()

# Enums
class WithdrawalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class PaymentMethod(str, Enum):
    ESEWA = "esewa"
    KHALTI = "khalti"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    full_name: str
    wallet_balance: float = 0.0
    total_earned: float = 0.0
    ads_watched: int = 0
    referral_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    referred_by: Optional[str] = None
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    wallet_balance: float
    total_earned: float
    ads_watched: int
    referral_code: str
    is_admin: bool
    created_at: datetime

class AdWatch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    ad_type: str = "video"
    reward_amount: float = 0.5
    watched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdWatchCreate(BaseModel):
    ad_type: str = "video"

class WithdrawalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    payment_method: PaymentMethod
    payment_id: str  # eSewa ID or Khalti ID
    status: WithdrawalStatus = WithdrawalStatus.PENDING
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None

class WithdrawalCreate(BaseModel):
    amount: float
    payment_method: PaymentMethod
    payment_id: str

class WithdrawalUpdate(BaseModel):
    status: WithdrawalStatus
    admin_notes: Optional[str] = None

class WalletTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # "ad_reward", "referral_bonus", "withdrawal"
    amount: float
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Utility functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict) and 'created_at' in item:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'].replace('Z', '+00:00'))
    return item

# Routes
@api_router.post("/auth/signup", response_model=dict)
async def signup(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = hash_password(user_data.password)
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=password_hash,
        full_name=user_data.full_name
    )
    
    # Handle referral
    if user_data.referral_code:
        referrer = await db.users.find_one({"referral_code": user_data.referral_code})
        if referrer:
            user.referred_by = referrer["id"]
            # Give referral bonus to referrer
            await db.users.update_one(
                {"id": referrer["id"]},
                {"$inc": {"wallet_balance": 5.0, "total_earned": 5.0}}
            )
            # Create transaction record
            transaction = WalletTransaction(
                user_id=referrer["id"],
                type="referral_bonus",
                amount=5.0,
                description=f"Referral bonus for inviting {user.full_name}"
            )
            await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
    
    # Insert user
    user_dict = prepare_for_mongo(user.dict())
    await db.users.insert_one(user_dict)
    
    # Create JWT token
    token = create_jwt_token(user.id, user.email)
    
    return {"token": token, "user": UserResponse(**user.dict())}

@api_router.post("/auth/login", response_model=dict)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_jwt_token(user["id"], user["email"])
    return {"token": token, "user": UserResponse(**user)}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

@api_router.post("/ads/watch", response_model=dict)
async def watch_ad(ad_data: AdWatchCreate, current_user: User = Depends(get_current_user)):
    # Simulate ad watching with reward
    reward_amount = 0.5  # $0.50 per ad
    
    # Create ad watch record
    ad_watch = AdWatch(
        user_id=current_user.id,
        ad_type=ad_data.ad_type,
        reward_amount=reward_amount
    )
    
    # Update user wallet and stats
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$inc": {
                "wallet_balance": reward_amount,
                "total_earned": reward_amount,
                "ads_watched": 1
            }
        }
    )
    
    # Create transaction record
    transaction = WalletTransaction(
        user_id=current_user.id,
        type="ad_reward",
        amount=reward_amount,
        description=f"Reward for watching {ad_data.ad_type} ad"
    )
    
    # Insert records
    await db.ad_watches.insert_one(prepare_for_mongo(ad_watch.dict()))
    await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
    
    return {
        "message": "Ad watched successfully!",
        "reward": reward_amount,
        "new_balance": current_user.wallet_balance + reward_amount
    }

@api_router.get("/wallet/balance", response_model=dict)
async def get_wallet_balance(current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    return {
        "balance": user["wallet_balance"],
        "total_earned": user["total_earned"],
        "ads_watched": user["ads_watched"]
    }

@api_router.get("/wallet/transactions", response_model=List[WalletTransaction])
async def get_transactions(current_user: User = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
    return [WalletTransaction(**parse_from_mongo(tx)) for tx in transactions]

@api_router.post("/withdrawals/request", response_model=dict)
async def request_withdrawal(withdrawal_data: WithdrawalCreate, current_user: User = Depends(get_current_user)):
    # Check minimum withdrawal amount
    if withdrawal_data.amount < 10.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is $10")
    
    # Check user balance
    user = await db.users.find_one({"id": current_user.id})
    if user["wallet_balance"] < withdrawal_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Create withdrawal request
    withdrawal = WithdrawalRequest(
        user_id=current_user.id,
        amount=withdrawal_data.amount,
        payment_method=withdrawal_data.payment_method,
        payment_id=withdrawal_data.payment_id
    )
    
    # Deduct amount from wallet (pending withdrawal)
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"wallet_balance": -withdrawal_data.amount}}
    )
    
    # Insert withdrawal request
    await db.withdrawals.insert_one(prepare_for_mongo(withdrawal.dict()))
    
    return {"message": "Withdrawal request submitted successfully", "request_id": withdrawal.id}

@api_router.get("/withdrawals/my-requests", response_model=List[WithdrawalRequest])
async def get_my_withdrawals(current_user: User = Depends(get_current_user)):
    withdrawals = await db.withdrawals.find({"user_id": current_user.id}).sort("requested_at", -1).to_list(100)
    return [WithdrawalRequest(**parse_from_mongo(w)) for w in withdrawals]

# Admin Routes
@api_router.get("/admin/withdrawals", response_model=List[dict])
async def get_all_withdrawals(admin_user: User = Depends(get_admin_user)):
    withdrawals = await db.withdrawals.find().sort("requested_at", -1).to_list(100)
    result = []
    for w in withdrawals:
        user = await db.users.find_one({"id": w["user_id"]})
        w["user_name"] = user["full_name"] if user else "Unknown"
        w["user_email"] = user["email"] if user else "Unknown"
        result.append(parse_from_mongo(w))
    return result

@api_router.put("/admin/withdrawals/{withdrawal_id}", response_model=dict)
async def update_withdrawal(
    withdrawal_id: str,
    update_data: WithdrawalUpdate,
    admin_user: User = Depends(get_admin_user)
):
    withdrawal = await db.withdrawals.find_one({"id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    update_dict = {
        "status": update_data.status,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if update_data.admin_notes:
        update_dict["admin_notes"] = update_data.admin_notes
    
    # If rejected, refund amount to user wallet
    if update_data.status == WithdrawalStatus.REJECTED:
        await db.users.update_one(
            {"id": withdrawal["user_id"]},
            {"$inc": {"wallet_balance": withdrawal["amount"]}}
        )
    
    await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": update_dict})
    
    return {"message": f"Withdrawal {update_data.status} successfully"}

@api_router.get("/admin/stats", response_model=dict)
async def get_admin_stats(admin_user: User = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    total_withdrawals = await db.withdrawals.count_documents({})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    total_ads_watched = await db.ad_watches.count_documents({})
    
    return {
        "total_users": total_users,
        "total_withdrawals": total_withdrawals,
        "pending_withdrawals": pending_withdrawals,
        "total_ads_watched": total_ads_watched
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()