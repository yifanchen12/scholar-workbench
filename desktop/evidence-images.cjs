'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const LIMIT=20*1024*1024;
function bytes(value){if(!(value instanceof Uint8Array)||!value.byteLength||value.byteLength>LIMIT)throw new Error('照片最大20 MB，请选择有效图片。');return Buffer.from(value.buffer,value.byteOffset,value.byteLength);}
function imageBytes(value,nativeImage,maxDimension){
  const image=nativeImage.createFromBuffer(bytes(value));if(image.isEmpty())throw new Error('无法解码图片，请选择 PNG、JPG、WebP 或 BMP 照片。');
  const {width,height}=image.getSize();if(width*height>40000000)throw new Error('图片像素过大，请先缩小到4,000万像素以内。');
  const scale=Math.min(1,maxDimension/Math.max(width,height)),output=scale<1?image.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality:'best'}):image;
  const data=output.toPNG();if(data.length>LIMIT)throw new Error('图片解码后过大，请先裁剪。');return {data,type:'image/png',...output.getSize()};
}
async function readPhoto(source){
  if(typeof source!=='string'||source.length>4096||!path.isAbsolute(source)||/[\u0000-\u001f]/.test(source)||! /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(source))throw new Error('请选择有效照片原路径。');
  try{const stat=await fs.promises.stat(source);if(!stat.isFile()||stat.size>LIMIT)throw new Error();const chunks=[];let size=0;for await(const chunk of fs.createReadStream(source,{end:LIMIT})){size+=chunk.length;if(size>LIMIT)throw new Error();chunks.push(chunk);}return Buffer.concat(chunks);}catch{throw new Error('原路径无法预览；重新拖入照片可保存本地副本。');}
}
async function preview(source,nativeImage){return imageBytes(await readPhoto(source),nativeImage,1800);}
function recognize(value,nativeImage,signal){
  if(process.platform!=='win32')return Promise.reject(new Error('本地 OCR 当前使用 Windows 10/11 内置识别；此系统暂不支持。'));
  const image=imageBytes(value,nativeImage,2600);
  return new Promise((resolve,reject)=>{
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'local-ocr.ps1')],{windowsHide:true,stdio:['pipe','pipe','ignore'],signal});
    const chunks=[];let size=0;const timer=setTimeout(()=>child.kill(),120000);timer.unref();
    child.stdin.on('error',()=>{});child.on('error',()=>{clearTimeout(timer);reject(new Error(signal?.aborted?'已取消识别。':'无法启动本地 OCR，请检查 Windows PowerShell。'));});
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>1024*1024)child.kill();else chunks.push(chunk);});
    child.on('close',code=>{clearTimeout(timer);if(signal?.aborted)return reject(new Error('已取消识别。'));try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''));if(code||result.error)throw new Error(result.error==='OCR_LANGUAGE_MISSING'?'请在 Windows 语言设置安装简体中文的光学字符识别组件。':'图片识别失败，请裁剪清晰文字后重试。');if(typeof result.text!=='string'||result.text.length>100000)throw new Error('识别文字过大。');resolve({text:result.text,language:String(result.language||'')});}catch(error){reject(new Error(error instanceof SyntaxError?'本地 OCR 未返回有效结果，请裁剪图片后重试。':error.message));}});
    child.stdin.end(JSON.stringify({image:image.data.toString('base64')}));
  });
}
module.exports={preview,recognize,imageBytes,readPhoto};
