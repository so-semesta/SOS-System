const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

code = code.replace(
  /              \}\)\}\n            \) : \(\n              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">/g,
  `              ))}
              </>
            ) : (
              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">`
);

fs.writeFileSync('src/pages/InternalHome.tsx', code);
