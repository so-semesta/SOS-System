const fs = require('fs');
let code = fs.readFileSync('src/services/guidanceService.ts', 'utf8');

code = code.replace(/\.\.\.doc\.data\(\)/g, '...(doc.data() as Record<string, any>)');
code = code.replace(/\.\.\.\(doc\.data\(\) as object\)/g, '...(doc.data() as Record<string, any>)');

fs.writeFileSync('src/services/guidanceService.ts', code);
