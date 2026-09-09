const fs = require('fs');
let code = fs.readFileSync('src/services/guidanceService.ts', 'utf8');

code = code.replace(
  /const logs = querySnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as GuidanceLog\)\);/g,
  'const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }) as GuidanceLog);'
);

fs.writeFileSync('src/services/guidanceService.ts', code);
