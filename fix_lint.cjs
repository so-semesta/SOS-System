const fs = require('fs');

// Fix guidanceService.ts
let guidance = fs.readFileSync('src/services/guidanceService.ts', 'utf8');
guidance = guidance.replace(
  /return snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as GuidanceLog\)\);/,
  'return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }) as GuidanceLog);'
);
fs.writeFileSync('src/services/guidanceService.ts', guidance);

// Fix InternalHome.tsx
let internalHome = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');
internalHome = internalHome.replace(
  /<DialogFooter>\n              \{isManager \? \(/,
  `<DialogFooter>
              { (userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT) ? (`
);
fs.writeFileSync('src/pages/InternalHome.tsx', internalHome);
