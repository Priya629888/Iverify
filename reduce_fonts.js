const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, 'src', 'Screens', 'Main');

const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(dirPath, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex for fontSize: normalize(X)
  content = content.replace(/fontSize:\s*normalize\((\d+(\.\d+)?)\)/g, (match, p1) => {
    let size = parseFloat(p1);
    // Reduce size by about 15-20%, or subtract 2 if size > 10
    let newSize = size > 10 ? Math.round(size * 0.8) : size; 
    return `fontSize: normalize(${newSize})`;
  });

  // Regex for fontSize: X
  content = content.replace(/fontSize:\s*(\d+(\.\d+)?)(?!\))/g, (match, p1) => {
    let size = parseFloat(p1);
    let newSize = size > 10 ? Math.round(size * 0.8) : size;
    return `fontSize: ${newSize}`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
});
