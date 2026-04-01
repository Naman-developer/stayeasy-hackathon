const fs = require('fs');

const f = fs.readFileSync('c:\\Users\\naman\\Documents\\pr2\\frontend\\css\\dashboard.css', 'utf8');
const roots = [];
const regex = /:root\s*\{/g;
let match;
while ((match = regex.exec(f)) !== null) {
  roots.push(match.index);
}
console.log('Roots found at indices:', roots);
