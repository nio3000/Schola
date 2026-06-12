import JSZip from 'jszip';
import fs from 'node:fs';

// Minimal valid DOCX
const docx = new JSZip();
docx.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
docx.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
docx.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
docx.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Schola DOCX Preview Test</w:t></w:r></w:p>
    <w:p><w:r><w:t>This is a valid DOCX document with English text.</w:t></w:r></w:p>
    <w:p><w:r><w:t>中文段落测试：Schola 多格式资源管理。</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section Two</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second section with more content for testing purposes.</w:t></w:r></w:p>
  </w:body>
</w:document>`);

// Minimal valid XLSX with 2 sheets
const xlsx = new JSZip();
xlsx.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);
xlsx.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
xlsx.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets>
    <sheet name="Test Data" sheetId="1" r:id="rId1"/>
    <sheet name="Summary" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`);
xlsx.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`);
xlsx.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">
  <si><t>Name</t></si>
  <si><t>Score</t></si>
  <si><t>Note</t></si>
  <si><t>Alice</t></si>
  <si><t>pass</t></si>
  <si><t>中文备注</t></si>
  <si><t>Bob</t></si>
  <si><t>good</t></si>
</sst>`);
xlsx.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>90</v></c><c r="C2" t="s"><v>4</v></c></row>
    <row r="3"><c r="A3" t="s"><v>6</v></c><c r="B3"><v>85</v></c><c r="C3" t="s"><v>5</v></c></row>
  </sheetData>
</worksheet>`);
xlsx.file('xl/worksheets/sheet2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>6</v></c><c r="B1"><v>85</v></c><c r="C1" t="s"><v>7</v></c></row>
  </sheetData>
</worksheet>`);

const docxDir = 'tests/fixtures/sample-vault/resources/docx';
const xlsxDir = 'tests/fixtures/sample-vault/resources/xlsx';
fs.mkdirSync(docxDir, { recursive: true });
fs.mkdirSync(xlsxDir, { recursive: true });

const docxBuf = await docx.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
const xlsxBuf = await xlsx.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

fs.writeFileSync(`${docxDir}/sample.docx`, docxBuf);
fs.writeFileSync(`${xlsxDir}/sample.xlsx`, xlsxBuf);

console.log(`Created sample.docx (${docxBuf.length} bytes, magic: ${docxBuf.slice(0,4).toString('hex')})`);
console.log(`Created sample.xlsx (${xlsxBuf.length} bytes, magic: ${xlsxBuf.slice(0,4).toString('hex')})`);
