import fs from 'fs';
import path from 'path';

function findMdFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && !file.startsWith('.')) {
        results = results.concat(findMdFiles(fullPath));
      }
    } else if (file.endsWith('.md')) {
      results.push(fullPath);
    }
  });
  return results;
}

function main() {
  // Search the current workspace
  const mdFiles = findMdFiles('.');
  console.log('Found markdown files:', mdFiles);
  mdFiles.forEach((f) => {
    const content = fs.readFileSync(f, 'utf8');
    const regex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      console.log(`File: ${f} -> Image path: ${match[1]}`);
    }
  });

  // Search the global configs or appDataDir artifacts
  const artifactDir = 'C:\\Users\\AA\\.gemini\\antigravity\\brain\\ba93d789-8984-4869-a801-aec52c86092f';
  if (fs.existsSync(artifactDir)) {
    const artFiles = findMdFiles(artifactDir);
    console.log('Found artifact markdown files:', artFiles);
    artFiles.forEach((f) => {
      const content = fs.readFileSync(f, 'utf8');
      const regex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        console.log(`Artifact File: ${f} -> Image path: ${match[1]}`);
      }
    });
  }
}

main();
