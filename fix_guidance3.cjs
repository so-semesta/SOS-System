const fs = require('fs');
let code = fs.readFileSync('src/services/guidanceService.ts', 'utf8');

code = code.replace(
  /const logs = querySnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.\(doc\.data\(\) as object\) \}\) as GuidanceLog\);/g,
  'const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuidanceLog);' // wait, this was the original error
);

// Ah, wait. Object types... maybe it needs to be `as Record<string, any>`?
code = code.replace(
  /const logs = querySnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.\(doc\.data\(\) as object\) \}\) as GuidanceLog\);/g,
  'const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) }) as GuidanceLog);'
);

// wait, let's just do a blanket replace for all three functions
code = code.replace(
  /const logs = querySnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as GuidanceLog\);/g,
  'const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) }) as GuidanceLog);'
);
code = code.replace(
  /return snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.\(doc\.data\(\) as object\) \} as GuidanceLog\);/g,
  'return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) }) as GuidanceLog);'
);

fs.writeFileSync('src/services/guidanceService.ts', code);
