from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
import subprocess
import os
import uuid
import shutil
from typing import List, Optional
from supabase import create_client, Client
import httpx
from datetime import datetime

app = FastAPI()

# =============================================================================
# Configuration
# =============================================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VIDEO_SERVICE_API_KEY = os.environ.get("VIDEO_SERVICE_API_KEY", "dev-key-change-in-prod")
STORAGE_BUCKET = os.environ.get("VIDEO_STORAGE_BUCKET", "videos")

# Initialize Supabase client
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# =============================================================================
# Authentication Middleware
# =============================================================================
async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Verify API key for service authentication"""
    if x_api_key != VIDEO_SERVICE_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    return x_api_key

# =============================================================================
# Models
# =============================================================================
class Scene(BaseModel):
    url: str
    duration: float

class ConcatRequest(BaseModel):
    scenes: List[Scene]
    output_path: str
    campaign_id: str

class ConcatResponse(BaseModel):
    success: bool
    output_url: str
    job_id: str
    scene_count: int
    storage_path: Optional[str] = None

# =============================================================================
# Helper Functions
# =============================================================================
def cleanup_temp_dir(temp_dir: str):
    """Clean up temporary directory and all its contents"""
    try:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            print(f"[Cleanup] Removed temp directory: {temp_dir}")
    except Exception as e:
        print(f"[Cleanup] Warning: Failed to clean up {temp_dir}: {e}")

async def upload_to_supabase(file_path: str, campaign_id: str, job_id: str) -> str:
    """Upload file to Supabase Storage and return public URL"""
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    
    # Generate storage path: videos/{campaign_id}/{timestamp}_{job_id}.mp4
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    storage_path = f"{campaign_id}/{timestamp}_{job_id}.mp4"
    
    with open(file_path, "rb") as f:
        file_data = f.read()
    
    # Upload to Supabase Storage
    result = supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_data,
        file_options={"content-type": "video/mp4"}
    )
    
    # Get public URL
    public_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
    
    return public_url, storage_path

# =============================================================================
# API Endpoints
# =============================================================================
@app.post("/concat", response_model=ConcatResponse)
async def concat_videos(
    request: ConcatRequest,
    api_key: str = Depends(verify_api_key)
):
    """Concatenate video scenes using FFmpeg and upload to Supabase Storage"""
    
    job_id = str(uuid.uuid4())
    temp_dir = f"/tmp/concat_{job_id}"
    
    try:
        # Create temp directory for this job
        os.makedirs(temp_dir, exist_ok=True)
        
        # Download scenes
        scene_files = []
        for i, scene in enumerate(request.scenes):
            scene_path = f"{temp_dir}/scene_{i}.mp4"
            # Download video using curl
            subprocess.run([
                "curl", "-L", "-o", scene_path, scene.url
            ], check=True, capture_output=True)
            scene_files.append(scene_path)
        
        # Create concat file list
        concat_file = f"{temp_dir}/concat.txt"
        with open(concat_file, 'w') as f:
            for scene_file in scene_files:
                f.write(f"file '{scene_file}'\n")
        
        # Run FFmpeg concat
        output_file = f"{temp_dir}/output.mp4"
        subprocess.run([
            "ffmpeg",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            "-y",  # Overwrite output file if exists
            output_file
        ], check=True, capture_output=True)
        
        # Upload to Supabase Storage
        public_url, storage_path = await upload_to_supabase(
            output_file,
            request.campaign_id,
            job_id
        )
        
        return ConcatResponse(
            success=True,
            output_url=public_url,
            job_id=job_id,
            scene_count=len(scene_files),
            storage_path=storage_path
        )
    
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # ALWAYS clean up temp files
        cleanup_temp_dir(temp_dir)

@app.get("/health")
async def health():
    """Health check endpoint"""
    supabase_status = "connected" if supabase else "not configured"
    return {
        "status": "healthy",
        "supabase": supabase_status,
        "storage_bucket": STORAGE_BUCKET
    }
