const fs = require('fs');
const lines = fs.readFileSync('tenant_out.txt', 'utf16le');
const start = lines.indexOf('firebaseConfig');
if (start !== -1) {
    console.log(lines.substring(start, start + 800));
} else {
    console.log('not found');
}
