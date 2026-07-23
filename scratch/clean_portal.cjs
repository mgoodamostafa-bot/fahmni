const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'ParentCenterPortal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove state declarations
content = content.replace(/\s*\/\/ Diagnostics & Debug states[\s\S]*?const \[showDebug, setShowDebug\] = useState\(false\);/, '');

// 2. Remove addLog function
content = content.replace(/\s*const addLog = \([\s\S]*?\};\r?\n/, '');

// 3. Remove all addLog calls
content = content.replace(/^[ \t]*addLog\([\s\S]*?\);\r?\n/gm, '');
// Also match inline addLog if any
content = content.replace(/[ \t]*addLog\([\s\S]*?\);/g, '');

// 4. Remove setLogs([]) call in handleLogin (inside catch/finally/logout if any)
content = content.replace(/^[ \t]*setLogs\(\[\]\);\r?\n/gm, '');

// 5. Remove diagnostic console UI at the bottom
const diagnosticSectionRegex = /\s*\{\/\* Toggle Diagnostic console \*\/\}[\s\S]*?<\/AnimatePresence>\s*<\/div>/;
content = content.replace(diagnosticSectionRegex, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully cleaned ParentCenterPortal.tsx!');
