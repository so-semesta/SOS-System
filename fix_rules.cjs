const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

// Replace osn match block
code = code.replace(
  /match \/osn\/\{osnId\} \{\n      allow read: if isSignedIn\(\);\n      allow write: if isSignedIn\(\) && isValidId\(osnId\) && isAdmin\(\);\n    \}/,
  `match /osn_announcements/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isValidId(docId) && isAdmin();
    }
    
    match /osn_banksoal/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isValidId(docId) && isAdmin();
    }
    
    match /archived_competitions/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isValidId(docId) && isAdmin();
    }
    
    match /chats/{chatId} {
      allow get: if isSignedIn();
      allow list: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isSignedIn() && isAdmin();
    }`
);

fs.writeFileSync('firestore.rules', code);
