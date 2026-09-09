const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

code = code.replace(
  /\) : announcements\.length > 0 \? \(\n              \{announcements\.map\(\(ann, idx\) => \(/,
  ') : announcements.length > 0 ? (\n              <>\n              {announcements.map((ann, idx) => ('
);

code = code.replace(
  /                  \/>\n                <\/div>\n              \)\}\n            \) : \(/,
  `                  />
                </div>
              ))}
              </>
            ) : (`
);

fs.writeFileSync('src/pages/InternalHome.tsx', code);
