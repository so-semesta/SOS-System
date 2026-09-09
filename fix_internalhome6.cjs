const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

code = code.replace(
  /              \)\}\n            \) : \(\n              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">/,
  `              ))}
              </>
            ) : (
              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">`
);

// Ah wait, it already did it wrongly previously because it replaced:
//            ) : announcements.length > 0 ? (
//              <>
//              {announcements.map((ann, idx) => (
// ...
//                  />
//                </div>
//              ))}
//              </>
//            ) : (
//              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">

// And then my fix_internalhome4 replaced again but actually replaced what I didn't want... Let's just fix it properly with full replace.
