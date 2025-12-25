from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import os
import uuid
from typing import List

app = FastAPI()

class Scene(BaseModel):
    url: str
    duration: float

class ConcatRequest(BaseModel):
    scenes: List[Scene]
    output_path: str
    campaign_id: str

@app.post("/concat")
async def concat_videos(request: ConcatRequest):
    """Concatenate video scenes using FFmpeg"""
    
    try:
        # Create temp directory for this job
        job_id = str(uuid.uuid4())
        temp_dir = f"/tmp/concat_{job_id}"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Download scenes
        scene_files = []
        for i, scene in enumerate(request.scenes):
            scene_path = f"{temp_dir}/scene_{i}.mp4"
            # Download video using curl
            subprocess.run([
                "curl", "-o", scene_path, scene.url
            ], check=True)
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
            output_file
        ], check=True)
        
        # In production, upload to S3/storage here
        # For now, return local path
        return {
            "success": True,
            "output_url": f"file://{output_file}",
            "job_id": job_id,
            "scene_count": len(scene_files)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy"}
