const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

// The string in question is exactly this chunk:
const searchString = `              ))}
            ) : (`;

const replaceString = `              ))}
              </>
            ) : (`;

code = code.replace(searchString, replaceString);

fs.writeFileSync('src/pages/InternalHome.tsx', code);
