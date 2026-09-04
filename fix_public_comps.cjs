const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  /match \/competitions\/\{competitionId\} \{\n      allow read: if isSignedIn\(\);\n      allow write: if isSignedIn\(\) && isValidId\(competitionId\) && isAdmin\(\);\n    \}/,
  `match /competitions/{competitionId} {
      allow read: if true;
      allow write: if isSignedIn() && isValidId(competitionId) && isAdmin();
    }`
);

fs.writeFileSync('firestore.rules', code);
