import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, 'frontend', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  console.log('\n🔍 Checking Brand Vault Data...\n');
  
  // 1. Check knowledge bases
  const { data: kbs, error: kbError } = await supabase
    .from('knowledge_bases')
    .select('*');
  
  console.log('📚 Knowledge Bases:');
  if (kbError) {
    console.error('❌ Error:', kbError.message);
  } else {
    console.log(`   Found ${kbs?.length || 0} knowledge bases`);
    kbs?.forEach(kb => {
      console.log(`   - ${kb.id}: ${kb.name} (brand: ${kb.brand_id})`);
    });
  }
  
  // 2. Check brands
  const { data: brands, error: brandError } = await supabase
    .from('brands')
    .select('id, name');
  
  console.log('\n🏢 Brands:');
  if (brandError) {
    console.error('❌ Error:', brandError.message);
  } else {
    console.log(`   Found ${brands?.length || 0} brands`);
    brands?.forEach(brand => {
      console.log(`   - ${brand.id}: ${brand.name}`);
    });
  }
  
  // 3. Check brand_knowledge_base table structure
  const { data: assets, error: assetError } = await supabase
    .from('brand_knowledge_base')
    .select('*')
    .limit(5);
  
  console.log('\n📦 Brand Assets:');
  if (assetError) {
    console.error('❌ Error:', assetError.message);
    console.log('   This might indicate table structure issues');
  } else {
    console.log(`   Found ${assets?.length || 0} assets (showing first 5)`);
    if (assets?.length > 0) {
      console.log('   Columns:', Object.keys(assets[0]).join(', '));
    }
  }
  
  console.log('\n✅ Data check complete!\n');
}

checkData().catch(console.error);
