import os
import secrets
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Header, HTTPException, Depends, status
from pydantic import BaseModel
from twscrape import API, gather

app = FastAPI(title="X Monitor Scraper Sidecar", version="1.0.0")

SHARED_SECRET = os.getenv("SIDECAR_SHARED_SECRET", "xmonitor-internal-secret-change-me")
DB_PATH = os.getenv("TWSCRAPE_DB_PATH", "/data/twscrape_accounts.db")

# Initialize twscrape API
api = API(pool_url=f"sqlite+aiosqlite:///{DB_PATH}")


def verify_secret(x_sidecar_secret: Optional[str] = Header(None)):
    if not x_sidecar_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header X-Sidecar-Secret is missing",
        )
    if not secrets.compare_digest(x_sidecar_secret, SHARED_SECRET):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid sidecar secret",
        )
    return True


class AddAccountRequest(BaseModel):
    username: str
    auth_token: str
    ct0: str


class ResolveRequest(BaseModel):
    username: str


class UserTweetsRequest(BaseModel):
    user_id: int | str
    limit: int = 20


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


@app.get("/health")
async def health(authorized: bool = Depends(verify_secret)):
    accounts = await api.pool.accounts()
    active = [a for a in accounts if a.active]
    locked = [a for a in accounts if not a.active or a.locks]
    return {
        "status": "ok",
        "accounts_count": len(accounts),
        "active_count": len(active),
        "locked_count": len(locked),
    }


@app.get("/accounts")
async def list_accounts(authorized: bool = Depends(verify_secret)):
    accounts = await api.pool.accounts()
    result = []
    for a in accounts:
        # Notice: Never expose cookies
        result.append({
            "username": a.username,
            "active": a.active,
            "last_error": a.last_error,
            "locks": [str(l) for l in (a.locks or [])],
        })
    return {"accounts": result}


@app.post("/accounts")
async def add_account(req: AddAccountRequest, authorized: bool = Depends(verify_secret)):
    # twscrape supports add_account with cookies
    try:
        # Dummy password/email since we use direct session cookies
        await api.pool.add_account(
            username=req.username,
            password="cookie_auth_only",
            email="none@example.com",
            email_password="none",
            cookies=f"auth_token={req.auth_token}; ct0={req.ct0}",
        )
        # Login using cookies
        await api.pool.login_all()
        return {"ok": True, "message": f"Account @{req.username} added successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to add account: {str(e)}")


@app.delete("/accounts/{username}")
async def delete_account(username: str, authorized: bool = Depends(verify_secret)):
    try:
        await api.pool.delete_accounts([username])
        return {"ok": True, "message": f"Account @{username} deleted."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/resolve")
async def resolve_user(req: ResolveRequest, authorized: bool = Depends(verify_secret)):
    try:
        user = await api.user_by_login(req.username)
        if not user:
            raise HTTPException(status_code=404, detail=f"User @{req.username} not found")
        return {
            "id": str(user.id),
            "username": user.username,
            "name": user.displayname,
            "avatar_url": user.profileImageUrl,
            "verified": user.verified,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def normalize_twscrape_tweet(t: Any) -> Dict[str, Any]:
    media_list = []
    if getattr(t, "media", None):
        for m in (t.media.photos or []):
            media_list.append({"type": "photo", "url": m.url, "preview_url": m.url})
        for m in (t.media.videos or []):
            media_list.append({
                "type": "video",
                "url": getattr(m, "variants", [{}])[0].get("url", ""),
                "preview_url": getattr(m, "thumbnailUrl", None),
            })
        for m in (t.media.animated or []):
            media_list.append({
                "type": "animated_gif",
                "url": getattr(m, "videoUrl", ""),
                "preview_url": getattr(m, "thumbnailUrl", None),
            })

    author_obj = getattr(t, "user", None)
    return {
        "id": str(t.id),
        "author": {
            "id": str(author_obj.id) if author_obj else None,
            "username": getattr(author_obj, "username", "unknown"),
            "name": getattr(author_obj, "displayname", "Unknown"),
            "avatar_url": getattr(author_obj, "profileImageUrl", None),
        },
        "text": getattr(t, "rawContent", "") or getattr(t, "content", ""),
        "lang": getattr(t, "lang", None),
        "created_at": t.date.isoformat() if getattr(t, "date", None) else None,
        "metrics": {
            "likes": getattr(t, "likeCount", 0) or 0,
            "retweets": getattr(t, "retweetCount", 0) or 0,
            "replies": getattr(t, "replyCount", 0) or 0,
            "quotes": getattr(t, "quoteCount", 0) or 0,
            "views": getattr(t, "viewCount", None),
        },
        "media": media_list,
        "url": getattr(t, "url", f"https://x.com/i/status/{t.id}"),
        "is_reply": getattr(t, "inReplyToTweetId", None) is not None,
        "is_retweet": getattr(t, "retweetedTweet", None) is not None,
        "is_quote": getattr(t, "quotedTweet", None) is not None,
    }


@app.post("/user-tweets")
async def user_tweets(req: UserTweetsRequest, authorized: bool = Depends(verify_secret)):
    try:
        user_id = int(req.user_id) if str(req.user_id).isdigit() else req.user_id
        tweets = await gather(api.user_tweets(user_id, limit=req.limit))
        return {"tweets": [normalize_twscrape_tweet(t) for t in tweets]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
async def search_tweets(req: SearchRequest, authorized: bool = Depends(verify_secret)):
    try:
        tweets = await gather(api.search(req.query, limit=req.limit, kv={"product": "Latest"}))
        return {"tweets": [normalize_twscrape_tweet(t) for t in tweets]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
