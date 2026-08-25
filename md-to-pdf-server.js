const http = require('http');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const PORT = 5177;
const logoSvg = fs.readFileSync(path.join(__dirname, '8views-logo.svg'), 'utf-8');
const logoDataUri = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg).toString('base64');

const contentStyle = `
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #10201F;
      margin: 0;
      padding: 0 48px;
      font-size: 13.5px;
      line-height: 1.6;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #27BFC8;
      margin: 0 0 6px;
      letter-spacing: -0.3px;
    }
    h2 {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #10201F;
      margin: 28px 0 12px;
      padding-left: 10px;
      border-left: 3px solid #27BFC8;
    }
    hr { border: none; border-top: 1px solid #DCE1E1; margin: 20px 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
      border: 1px solid #C7CDCD;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    th {
      background: #EDEFEF;
      text-align: left;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 8px 12px;
      border-bottom: 2px solid #27BFC8;
      border-right: 1px solid #C7CDCD;
    }
    th:last-child { border-right: none; }
    td {
      padding: 9px 12px;
      border-top: 1px solid #C7CDCD;
      border-right: 1px solid #C7CDCD;
      vertical-align: top;
      word-break: break-word;
    }
    td:last-child { border-right: none; }
    tr td:first-child { color: #52696C; font-weight: 600; white-space: nowrap; }
    code {
      font-family: ui-monospace, 'SF Mono', Consolas, monospace;
      font-size: 12.5px;
      background: #F7F9F9;
      border: 1px solid #DCE1E1;
      color: #1C8A91;
      padding: 1px 5px;
      border-radius: 4px;
      word-break: break-all;
    }
    a { color: #27BFC8; }
  </style>
`;

async function markdownToPdfBuffer(mdSource, { pageSize = 'A4', watermark = true } = {}) {
  const bodyHtml = marked.parse(mdSource);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">${contentStyle}</head><body>${bodyHtml}</body></html>`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  const headerTemplate = watermark
    ? `
      <div style="width: 100%; font-size: 10px; padding: 0 40px; -webkit-print-color-adjust: exact;">
        <div style="display: flex; justify-content: flex-end;">
          <img src="${logoDataUri}" style="height: 36px;">
        </div>
      </div>
    `
    : `<div></div>`;

  const pdfBuffer = await page.pdf({
    format: pageSize === 'Letter' ? 'Letter' : 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate: `<div></div>`,
    margin: { top: watermark ? '70px' : '40px', bottom: '40px', left: '0px', right: '0px' },
  });

  await browser.close();
  return pdfBuffer;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'md-editor.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/export') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { markdown, pageSize, watermark } = JSON.parse(body);
        const pdfBuffer = await markdownToPdfBuffer(markdown || '', { pageSize, watermark });
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"',
        });
        res.end(pdfBuffer);
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to generate PDF: ' + err.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Markdown → PDF editor running at http://localhost:${PORT}`);
});
