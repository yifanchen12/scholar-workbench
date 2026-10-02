'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const net=require('node:net');
const {spawn}=require('node:child_process');
const path=require('node:path');
const serverFile=path.resolve(__dirname,'../server.js');
function start(port){
  // Intercept only the browser-opening command. Real port binding and HTTP checks still run.
  const script=`require('node:child_process').execFile=(file,args,options,callback)=>{console.log('__BROWSER_COMMAND__'+JSON.stringify({file,args,options}));callback(null);};process.argv.push('--open');require(${JSON.stringify(serverFile)});`;
  const child=spawn(process.execPath,['-e',script],{env:{...process.env,STUDY_PORT:String(port)},windowsHide:true});
  let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));});
  return {child,done,output:()=>stdout};
}
async function fixture(headers,respond=true){
  const server=http.createServer((req,res)=>{if(respond){res.writeHead(200,headers);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {port:server.address().port,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
function command(output,port){
  const line=output.split('\n').find(line=>line.startsWith('__BROWSER_COMMAND__'));
  if(process.platform==='win32'){
    assert.ok(line,'browser command not dispatched');const value=JSON.parse(line.slice('__BROWSER_COMMAND__'.length));assert.equal(value.file,'cmd.exe');assert.deepEqual(value.args,['/d','/c','start','',`http://127.0.0.1:${port}`]);assert.equal(value.options.windowsHide,true);
  }else assert.equal(line,undefined);
}
(async()=>{
  for(const [headers,respond,isOwn] of [[{'X-Study-Workbench':'youyan-local-v1'},true,true],[{},true,false],[{},false,false]]){
    const held=await fixture(headers,respond),run=start(held.port);const timeout=setTimeout(()=>run.child.kill(),5000);
    try{
      const result=await run.done;assert.equal(result.code,isOwn?0:1);assert.match(isOwn?result.stdout:result.stderr,isOwn?/工作台已经运行/:/已被其他程序占用/);
      if(isOwn)command(result.stdout,held.port);else assert.ok(!result.stdout.includes('__BROWSER_COMMAND__'));
    }finally{clearTimeout(timeout);run.child.kill();await held.close();}
  }
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const run=start(port),timeout=setTimeout(()=>run.child.kill(),5000);
  try{
    // Wait for the actual listening announcement, rather than an arbitrary startup delay.
    await new Promise((resolve,reject)=>{run.child.stdout.on('data',()=>{if(run.output().includes('Local only.'))resolve();});run.child.on('exit',code=>reject(new Error('server exited before listen: '+code)));});
    const response=await fetch(`http://127.0.0.1:${port}`);assert.equal(response.status,200);assert.equal(response.headers.get('x-study-workbench'),'youyan-local-v1');await response.text();command(run.output(),port);
  }finally{clearTimeout(timeout);run.child.kill();await run.done;}
  console.log('Launcher checks passed: new server binds locally, existing workbench is reused, unrelated and stalled services are rejected; Windows browser command arguments verified with a test substitute.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
