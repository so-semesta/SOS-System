const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

// Replace the CardFooter logic
code = code.replace(
  /<CardFooter className=\{\`pt-4 border-t flex flex-col items-stretch gap-3 \$\{isGold \? 'border-amber-200' : isYellow \? 'border-yellow-200' : ''\}\`\}>\n                        \{isManager && \([\s\S]*?\) : 'Gratis'\n                        \}<\/p>/g,
  (match) => {
    // we need a better regex or string replacement. Let's just do a specific string replace.
    return match; // return it unchanged for now, I will use precise replace below
  }
);
