'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const assets = new Set(['index.html','style.css','app.js','core.js','content.js','ai-lab.js','metrics-lab.js','digits-model.js','digits-lab.js','logic-practice.js','logic-circuit.js','card-import.js','favicon.svg','practice/tiny_llm.py','docs/AI专业学习与训练实训.md','training-run.js','training-lab.js','vault.js','textbook-schema.js','textbook.js','curriculum-content.js','curriculum.js','records.js','output/pdf/数字逻辑与AI基础速练册.pdf','docs/学习练习册.md','output/邮研-Python实训包.zip','examples/AI实训复习卡.txt','practice/output/从梯度到分类-实训讲义.pdf']);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.md':'text/markdown; charset=utf-8','.zip':'application/zip','.txt':'text/plain; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream','.wasm':'application/wasm','.py':'text/plain; charset=utf-8'};
const port = Number(process.env.STUDY_PORT || 5179);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('STUDY_PORT must be an integer from 1024 to 65535');
const url=`http://127.0.0.1:${port}`,marker='youyan-local-v1';
function openBrowser(){
  if(process.argv.includes('--open') && process.platform==='win32')require('node:child_process').execFile('cmd.exe',['/d','/c','start','',url],{windowsHide:true},error=>{if(error)console.log('请在浏览器打开上面的地址。');});
}
const server = http.createServer((req,res)=>{
  let filename;
  try { filename = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400);res.end('Bad request');return; }
  if(filename==='api/textbook'){require('./deepseek-api.js').handle(req,res,url);return;}
  if(req.headers.host!==new URL(url).host){res.writeHead(403);res.end('Invalid host');return;}
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return; }
  if (!assets.has(filename) && !(filename.startsWith('vendor/pdfjs/') && !filename.split('/').some(s=>s==='..'||s.includes('\\')) && /\.(mjs|bcmap|ttf|pfb|wasm)$/.test(filename))) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(root,filename),(error,data)=>{
    if(error){res.writeHead(500);res.end('Unable to read local asset');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'text/plain','Cache-Control':'no-cache','X-Study-Workbench':marker,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
    res.end(req.method==='HEAD'?undefined:data);
  });
});
// Generation may wait indefinitely; header/body upload limits are unchanged.
server.setTimeout(0);
server.on('error',e=>{
  const occupied=()=>{console.error(`端口 ${port} 已被其他程序占用。请直接打开 index.html，或设置 STUDY_PORT 使用其他端口。`);process.exitCode=1;};
  if(e.code!=='EADDRINUSE'){console.error('无法启动本地服务。');process.exitCode=1;return;}
  const check=http.request(url,{method:'HEAD'},res=>{
    res.resume();if(res.statusCode===200 && res.headers['x-study-workbench']===marker){console.log(`工作台已经运行 · ${url}`);openBrowser();}
    else occupied();
  });
  check.setTimeout(1500,()=>check.destroy(new Error('Local identity check timed out.')));check.on('error',occupied);check.end();
});
server.listen(port,'127.0.0.1',()=>{
  console.log(`邮研学习工作台 · ${url}\nLocal only. Ctrl+C to stop. PDF and evidence stay in this browser. Selected textbook text is sent to your configured API only when generating.`);
  openBrowser();
});
