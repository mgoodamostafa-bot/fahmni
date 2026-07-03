const configStr = `{
  apiKey: "AIzaSyBpZFKK1eGWwnRkY6J8tqfrcXMEmc_GC9w",
  authDomain: "fahmni-8d6ae.firebaseapp.com",
  projectId: "fahmni-8d6ae",
  storageBucket: "fahmni-8d6ae.firebasestorage.app",
  messagingSenderId: "551965665398",
  appId: "1:551965665398:web:cbae0aede7cab124cf1757"
}`;

const modified = configStr
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*\}/g, '}');

console.log(modified);
console.log(JSON.parse(modified));
