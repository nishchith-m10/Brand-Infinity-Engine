
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_BASE_URL || !N8N_API_KEY) {
  console.error('Missing N8N credentials');
  process.exit(1);
}

async function getWorkflows() {
  try {
    const response = await fetch(`${N8N_BASE_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    });

    if (!response.ok) {
        // Try getting active workflows specifically if generic list fails, though /workflows usually works
      throw new Error(`Failed to fetch workflows: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return [];
  }
}

async function main() {
  const workflows = await getWorkflows();
  const tagCounts: Record<string, number> = {};
  const workflowsByTag: Record<string, string[]> = {};

  workflows.forEach((wf: any) => {
    if (wf.tags && wf.tags.length > 0) {
      wf.tags.forEach((tag: any) => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
        if (!workflowsByTag[tagName]) workflowsByTag[tagName] = [];
        workflowsByTag[tagName].push(wf.name);
      });
    } else {
        tagCounts['(No Tag)'] = (tagCounts['(No Tag)'] || 0) + 1;
    }
  });

  console.log('--- Workflow Counts by Tag ---');
  for (const [tag, count] of Object.entries(tagCounts)) {
    console.log(`${tag}: ${count}`);
  }
  
  if (Object.keys(tagCounts).length === 0) {
      console.log("No tags found on any workflows.");
  }
}

main();
