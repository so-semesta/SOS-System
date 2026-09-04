const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/GuidanceMonitor.tsx', 'utf8');

code = code.replace(
  /setLoading\(false\);/,
  "setLoading(false);\n      setIsLoadingMore(false);"
);

fs.writeFileSync('src/pages/admin/GuidanceMonitor.tsx', code);
