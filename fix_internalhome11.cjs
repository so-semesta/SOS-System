const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');
code = code.replace(
  `}
              ))}
            ) : (`,
  `}
              ))}
              </>
            ) : (`
);
fs.writeFileSync('src/pages/InternalHome.tsx', code);
