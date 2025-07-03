const fs = require('fs');
const path = require('path');

const junitPath = path.join(__dirname, '..', 'coverage', 'junit.xml');

if (fs.existsSync(junitPath)) {
  const xml = fs.readFileSync(junitPath, 'utf8');
  const fixedXml = xml.replace(/\\/g, '/');
  fs.writeFileSync(junitPath, fixedXml);
  console.log('Fixed junit.xml: replaced backslashes with forward slashes');
} else {
  console.log('junit.xml not found, skipping fix');
} 