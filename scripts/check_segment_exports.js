const fs = require('fs');
const glob = require('glob');
const allowedDynamic = ['auto','force-dynamic','force-static'];
const allowedRuntime = ['edge','nodejs'];
const files = glob.sync('app/**/*.{ts,tsx}');
let problems = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const regex = /export\s+const\s+(dynamic|revalidate|runtime|fetchCache|dynamicParams|preferredRegion)\s*=\s*([^;\n]+);/g;
  let m;
  while ((m = regex.exec(s))) {
    const name = m[1];
    const val = m[2].trim();
    if (name === 'dynamic') {
      if (!/^['\"]/.test(val) || !allowedDynamic.includes(val.replace(/['\"]/g, ''))) problems.push({ file: f, name, val });
    } else if (name === 'runtime') {
      if (!/^['\"]/.test(val) || !allowedRuntime.includes(val.replace(/['\"]/g, ''))) problems.push({ file: f, name, val });
    } else if (name === 'revalidate') {
      if (!/^\d+$/.test(val) && !/^CACHE_/.test(val) && val !== 'false' && !/^['\"]\d+['\"]/.test(val)) problems.push({ file: f, name, val });
    } else if (name === 'dynamicParams') {
      if (!(val === 'true' || val === 'false')) problems.push({ file: f, name, val });
    }
  }
}
console.log(JSON.stringify({ checked: files.length, problems }, null, 2));