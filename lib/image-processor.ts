/**
 * Image Processing Utility
 * 
 * Processes uploaded images to extract:
 * - Text content (OCR)
 * - Visual descriptions
 * - Brand elements (colors, logos, typography)
 * - Tags and metadata
 * 
 * Phase 1 Critical Fix: OpenAI Vision API integration
 */

import OpenAI from 'openai';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

interface ImageAnalysisResult {
  textContent: string;
  description: string;
  dominantColors: string[];
  detectedObjects: string[];
  tags: string[];
  brandElements: {
    logos?: string[];
    typography?: string[];
    colorPalette?: string[];
  };
  confidence: number;
}

// Lazy initialize OpenAI client
let _openai: OpenAI | null = null;

async function getOpenAI(): Promise<OpenAI | null> {
  if (!_openai) {
    const apiKey = await getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY);
    if (!apiKey) {
      console.warn('[ImageProcessor] OpenAI API key not configured, Vision API disabled');
      return null;
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

/**
 * Process an image file and extract content using Vision API
 * 
 * Cost: ~$0.01-0.03 per image (using gpt-4o-mini)
 */
export async function processImage(
  file: File,
  fileUrl: string
): Promise<string> {
  try {
    // Try Vision API analysis first
    const openai = await getOpenAI();
    if (openai && fileUrl) {
      console.log(`[ImageProcessor] Analyzing image with Vision API: ${file.name}`);
      const analysis = await analyzeImageWithVisionAPI(openai, fileUrl, file.name);
      if (analysis) {
        return formatAnalysisAsContent(file.name, analysis);
      }
    }
    
    // Fallback to basic content if Vision API is unavailable
    console.log(`[ImageProcessor] Using basic analysis for: ${file.name}`);
    return generateBasicImageContent(file);
  } catch (error) {
    console.error('[ImageProcessor] Error processing image:', error);
    // Fallback to basic content on error
    return generateBasicImageContent(file);
  }
}

/**
 * Analyze image using OpenAI Vision API (gpt-4o-mini for cost efficiency)
 * 
 * Cost breakdown:
 * - gpt-4o-mini: ~$0.01-0.03 per image depending on size
 * - Optimized for brand asset uploads (typically low volume)
 */
async function analyzeImageWithVisionAPI(
  openai: OpenAI,
  imageUrl: string,
  fileName: string
): Promise<ImageAnalysisResult | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Most cost-effective vision model
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this brand asset image (${fileName}). Provide a JSON response with:
1. "textContent": Any text visible in the image (OCR)
2. "description": A brief description of the image content
3. "dominantColors": Array of dominant colors as hex codes (e.g., ["#FF5733", "#3498DB"])
4. "detectedObjects": Array of objects/elements detected
5. "tags": Array of relevant tags for categorization
6. "brandElements": Object with "logos" (if any brand logos detected), "typography" (font styles observed), "colorPalette" (brand colors)
7. "confidence": Confidence score 0-1

Respond ONLY with valid JSON, no markdown formatting.`,
            },
            {
              type: 'image_url',
              image_url: { 
                url: imageUrl,
                detail: 'low' // Use low detail for cost efficiency
              },
            },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.2, // Low temperature for consistent analysis
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[ImageProcessor] Empty response from Vision API');
      return null;
    }

    // Parse JSON response, handling potential markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }

    const analysis = JSON.parse(jsonContent) as ImageAnalysisResult;
    console.log(`[ImageProcessor] Vision analysis complete for ${fileName}: ${analysis.tags?.length || 0} tags, ${analysis.dominantColors?.length || 0} colors`);
    return analysis;
  } catch (error) {
    console.error('[ImageProcessor] Vision API analysis failed:', error);
    return null;
  }
}

/**
 * Format analysis result as searchable content for RAG
 */
function formatAnalysisAsContent(fileName: string, analysis: ImageAnalysisResult): string {
  const lines: string[] = [];
  
  // File info
  lines.push(`Image: ${fileName}`);
  lines.push(`Description: ${analysis.description || 'Brand asset image'}`);
  
  // OCR text
  if (analysis.textContent) {
    lines.push(`\nText Content:\n${analysis.textContent}`);
  }
  
  // Colors
  if (analysis.dominantColors?.length > 0) {
    lines.push(`\nDominant Colors: ${analysis.dominantColors.join(', ')}`);
  }
  
  // Brand elements
  if (analysis.brandElements) {
    if (analysis.brandElements.logos?.length) {
      lines.push(`Logos: ${analysis.brandElements.logos.join(', ')}`);
    }
    if (analysis.brandElements.typography?.length) {
      lines.push(`Typography: ${analysis.brandElements.typography.join(', ')}`);
    }
    if (analysis.brandElements.colorPalette?.length) {
      lines.push(`Brand Colors: ${analysis.brandElements.colorPalette.join(', ')}`);
    }
  }
  
  // Objects and tags
  if (analysis.detectedObjects?.length > 0) {
    lines.push(`\nDetected Elements: ${analysis.detectedObjects.join(', ')}`);
  }
  
  if (analysis.tags?.length > 0) {
    lines.push(`Tags: ${analysis.tags.join(', ')}`);
  }
  
  lines.push(`\nAnalysis Confidence: ${Math.round((analysis.confidence || 0.8) * 100)}%`);
  
  return lines.join('\n');
}

/**
 * Generate basic content from file metadata (fallback)
 */
function generateBasicImageContent(file: File): string {
  const name = file.name;
  const type = file.type;
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  
  // Extract potential context from filename
  const nameLower = name.toLowerCase();
  let context = '';
  
  if (nameLower.includes('logo')) {
    context = 'Brand logo image';
  } else if (nameLower.includes('product')) {
    context = 'Product image';
  } else if (nameLower.includes('color') || nameLower.includes('palette')) {
    context = 'Color palette or swatch';
  } else if (nameLower.includes('banner') || nameLower.includes('hero')) {
    context = 'Banner or hero image';
  } else if (nameLower.includes('icon')) {
    context = 'Icon or graphic element';
  } else {
    context = 'Brand asset image';
  }
  
  return `${context}: ${name}
File type: ${type}
Size: ${sizeMB}MB

[Vision API analysis available when OpenAI API key is configured]`;
}

/**
 * Process PDF files to extract text
 */
export async function processPDF(
  file: File,
  fileUrl: string
): Promise<string> {
  try {
    // TODO: Integrate PDF text extraction (pdf-parse, pdfjs, or similar)
    return `PDF Document: ${file.name}
File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB

[PDF text extraction pending - integrate pdf-parse or similar library]`;
  } catch (error) {
    console.error('[ImageProcessor] Error processing PDF:', error);
    return `PDF: ${file.name}\n[Processing failed]`;
  }
}

/**
 * Check if Vision API is available
 */
export async function isVisionAPIAvailable(): Promise<boolean> {
  const openai = await getOpenAI();
  return openai !== null;
}

