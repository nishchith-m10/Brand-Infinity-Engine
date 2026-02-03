
import { getVideoService } from '@/lib/video/service';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyPollinations() {
  console.log('Testing Pollinations Video Generation...');
  const service = getVideoService();
  
  try {
    const job = await service.generateVideo({
      prompt: 'A futuristic city with flying cars, cyberpunk style',
      duration: 5,
      provider: 'pollinations'
    });
    
    console.log('Job created successfully:', job);
    
    if (job.status === 'completed' && job.videoUrl) {
      console.log('Video generated successfully!');
      console.log('URL:', job.videoUrl);
    } else {
      console.log('Job status:', job.status);
    }
    
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

verifyPollinations();
