import fs from 'fs';

const html = fs.readFileSync('public/os.html', 'utf8');
const js = fs.readFileSync('public/osEngine.js', 'utf8');

const idRegex = /id=["']([^"']+)["']/g;
let m;
const ids = [];
while ((m = idRegex.exec(html)) !== null) {
  ids.push(m[1]);
}

console.log('Total IDs found in os.html:', ids.length);
const unreferenced = ids.filter(id => !js.includes(id));
console.log('Unreferenced IDs in osEngine.js (' + unreferenced.length + '):');
unreferenced.forEach(id => console.log(' -', id));

