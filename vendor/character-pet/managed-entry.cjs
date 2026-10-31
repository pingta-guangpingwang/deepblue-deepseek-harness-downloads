'use strict';
const path=require('node:path');
async function waitForRendererReady(shell,{timeoutMs=15000,intervalMs=40}={}) {
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){const state=shell.getState()?.playback;if(state?.status==='error'||state?.status==='disposed')break;if(state?.configured&&state.action&&['paused','playing','ended'].includes(state.status))return;await new Promise(resolve=>setTimeout(resolve,intervalMs));}
 throw Error('桌宠素材未成功显示，请重新安装桌宠模块。');
}
function readConfig(env) {
 const roleId=env.COMPANION_MANAGED_ROLE,directory=env.COMPANION_USER_DATA,endpoint=env.COMPANION_CHAT_ENDPOINT,token=env.COMPANION_CHAT_TOKEN;
 if(!/^role-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(roleId||'')||!directory||!path.isAbsolute(directory)||directory.replaceAll('\\','/').startsWith('//')||!/^[a-f0-9]{64}$/.test(token||'')||!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/chat$/.test(endpoint||''))throw Error('请从启动器的角色页面开启桌宠。');
 const url=new URL(endpoint);if(Number(url.port)>65535)throw Error('无效的启动器接口。');
 const name=(env.COMPANION_DISPLAY_NAME||'我的角色').slice(0,40);
 return {roleId,directory,endpoint,token,name};
}
async function bootManaged(electron,env=process.env) {
 const config=readConfig(env),{app}=electron,fs=require('node:fs');
 const resources=require('./managed-resources.cjs');resources.registerResourceScheme(electron.protocol);
 // Must precede the instance lock; never connect to the independent companion's profile.
 app.setName('DeepBlueCharacterPet');app.setPath('userData',config.directory);
 if(!app.requestSingleInstanceLock()){app.quit();return;}
 app.on('browser-window-created',(_event,window)=>{const title=config.name+' · 桌面伙伴';window.setTitle(title);window.on('page-title-updated',event=>{event.preventDefault();window.setTitle(title);});});
 const profile=path.resolve(config.directory);fs.mkdirSync(profile,{recursive:true});
 const {createSettingsStore}=require('./settings.cjs');
 createSettingsStore(profile).updateSettings({displayName:config.name,chatEndpoint:''});
 const headers={authorization:'Bearer '+config.token,'content-type':'application/json'};
 const call=async(message,signal)=>{
  const response=await fetch(config.endpoint,{method:'POST',headers,redirect:'error',signal,body:JSON.stringify({message})});
  if(!response.ok)throw Error('请在启动器内检查对应角色是否已开启。');
  const data=await response.json();if(typeof data.reply!=='string'||data.reply.length>32000)throw Error('角色回复不可用。');
  return {ok:true,reply:data.reply,conversationId:config.roleId};
 };
 const requests=new Set();
 const nativeChat={status:async()=>({available:true,name:config.name,contextId:config.roleId,message:'使用启动器中此角色的固定对话。'}),
  send:async value=>{const controller=new AbortController();requests.add(controller);try{return await call(value?.message,AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]));}catch{return {ok:false,message:'角色回复未完成，请返回启动器查看状态。'};}finally{requests.delete(controller);}},
  history:async()=>({messages:[]}),clear:async()=>({ok:true}),dispose:()=>{for(const r of requests)r.abort();requests.clear();}};
 await app.whenReady();
 const appRoot=path.resolve(__dirname,'..'),resourceURL=await resources.installResourceProtocol(electron.protocol,appRoot);
 const shell=require('./main.cjs').createDesktopShell(electron,{appRoot,userDataDir:profile,managedRole:true,nativeChat,resourceURL});
 await shell.start();
 await waitForRendererReady(shell);
 const control=await require('./managed-control.cjs').createManagedControl(shell,{file:path.join(profile,'companion-control.json'),profile,roleId:config.roleId});
 let checking=false,missed=0;
 const heartbeat=setInterval(async()=>{if(checking)return;checking=true;try{const response=await fetch(config.endpoint.replace(/\/chat$/,'/health'),{headers,redirect:'error',signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('Unavailable');missed=0;}catch{if(++missed>=3)app.quit();}finally{checking=false;}},2000);heartbeat.unref();
 app.on('before-quit',()=>{clearInterval(heartbeat);nativeChat.dispose();void control.close();});
 app.on('second-instance',()=>shell.show());app.on('activate',()=>shell.show());
 return shell;
}
if(require.main===module){const electron=require('electron');bootManaged(electron).catch(()=>electron.app.quit());}
module.exports={readConfig,bootManaged,waitForRendererReady};
