'use strict';
const {contextBridge,ipcRenderer,webUtils}=require('electron');
const origin=process.argv.find(value=>value.startsWith('--study-origin='))?.slice(15);
if(origin&&location.origin===origin&&['/','/index.html'].includes(location.pathname)){
  contextBridge.exposeInMainWorld('StudyDesktop',{
    pathsForFiles:files=>{const paths=Array.from(files,file=>webUtils.getPathForFile(file));if(paths.some(value=>!value))throw new Error('请从资源管理器拖入已保存的原文件；内存图片没有可记录的磁盘路径。');return paths;},
    saveWorkspaceBackup:json=>ipcRenderer.invoke('study:save-backup',json),
    exportEvidenceBundle:payload=>ipcRenderer.invoke('study:export-evidence',payload),
    previewEvidence:source=>ipcRenderer.invoke('study:preview-image',source),
    recognizeEvidence:input=>ipcRenderer.invoke('study:ocr-image',input),
    cancelEvidenceOCR:()=>ipcRenderer.invoke('study:cancel-ocr'),
    getPhotoFolder:()=>ipcRenderer.invoke('study:photo-folder'),
    choosePhotoFolder:()=>ipcRenderer.invoke('study:choose-photo-folder'),
    savePhoto:input=>ipcRenderer.invoke('study:save-photo',input),
    pastePhoto:()=>ipcRenderer.invoke('study:paste-photo'),
    takeHandoff:()=>ipcRenderer.invoke('study:take-handoff'),
    onHandoff:callback=>{ipcRenderer.on('study:handoff-ready',()=>callback());}
  });
}
