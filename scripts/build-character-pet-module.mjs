import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const source=path.resolve(arg('--source')||'../qq-desktop-companion/app-v02');
const runtime=arg('--runtime');
const out=arg('--out');
const version='0.2.2';
if(!runtime||!out)throw Error('Usage: node scripts/build-character-pet-module.mjs --source APP_SOURCE --runtime PORTABLE_RUNTIME_DIRECTORY --out NEW_OUTPUT_DIRECTORY');
const target=path.resolve(out),runtimeRoot=path.resolve(runtime);
for(const base of [repo,source,runtimeRoot]){const relative=path.relative(target,base);if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('Output must not contain source or runtime');}
await fs.mkdir(path.dirname(target),{recursive:true});await fs.mkdir(target); // Exclusive output, never replace a previous package.
const portable=path.join(target,'character-pet-runtime');await fs.mkdir(portable);
const runtimeFiles=['DeepBlueCompanionV02.exe','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','ffmpeg.dll','icudtl.dat','libEGL.dll','libGLESv2.dll','LICENSE','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader.dll','vk_swiftshader_icd.json','vulkan-1.dll'];
for(const name of runtimeFiles){const stat=await fs.lstat(path.join(runtimeRoot,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Missing or unsafe runtime: '+name);await fs.copyFile(path.join(runtimeRoot,name),path.join(portable,name));}
await fs.cp(path.join(runtimeRoot,'locales'),path.join(portable,'locales'),{recursive:true,filter:async file=>!(await fs.lstat(file)).isSymbolicLink()});
const appRoot=path.join(portable,'resources','app');await fs.mkdir(appRoot,{recursive:true});
const allowedExt=new Set(['.cjs','.mjs','.js','.json','.css','.html','.png','.webp','.svg','.txt','.md']);
for(const name of ['main','preload','renderer','assets'])await fs.cp(path.join(source,name),path.join(appRoot,name),{recursive:true,filter:async file=>{
 const stat=await fs.lstat(file),relative=path.relative(source,file).split(path.sep);
 return !stat.isSymbolicLink()&&!relative.some(part=>['node_modules','.qa','qa','cache','__pycache__','tools'].includes(part))&&(stat.isDirectory()||allowedExt.has(path.extname(file)));
}});
for(const name of ['managed-entry.cjs','managed-control.cjs','managed-resources.cjs'])await fs.copyFile(path.join(repo,'vendor','character-pet',name),path.join(appRoot,'main',name));
await fs.writeFile(path.join(appRoot,'package.json'),JSON.stringify({name:'deepblue-character-pet',productName:'DeepBlueCharacterPet',version,main:'main/managed-entry.cjs'},null,2));
// Bind the existing shell to its launcher role, including configuration changes made in its settings window.
const mainFile=path.join(appRoot,'main','main.cjs');let main=await fs.readFile(mainFile,'utf8');
const original='function updateSettings(patch){const result=store.updateSettings(patch);';
if(!main.includes(original))throw Error('Desktop shell source contract changed; review managed settings boundary.');
main=main.replace(original,"function updateSettings(patch){if(options.managedRole){patch={...patch,chatEndpoint:''};}const result=store.updateSettings(patch);");
for(const [before,after] of [['const url = pathToFileURL(file).href;','const url = options.resourceURL ? options.resourceURL(file) : pathToFileURL(file).href;'],['return win.loadFile(file);','return options.resourceURL ? win.loadURL(url) : win.loadFile(file);']]){if(!main.includes(before))throw Error('Desktop resource contract changed');main=main.replace(before,after);}await fs.writeFile(mainFile,main);
const playerFile=path.join(appRoot,'renderer/vendor/sequence-player.mjs');let player=await fs.readFile(playerFile,'utf8');const oldProtocols="!['http:', 'https:', 'file:'].includes(origin.protocol)";if(!player.includes(oldProtocols))throw Error('Frame URL contract changed');player=player.replace(oldProtocols,"!['http:', 'https:', 'file:'].includes(origin.protocol) && !(origin.protocol === 'deepblue-pet:' && origin.hostname === 'app')");await fs.writeFile(playerFile,player);
const chatFile=path.join(appRoot,'renderer','chat.mjs');let chat=await fs.readFile(chatFile,'utf8');
chat=chat.replaceAll('自动 QQ 伙伴','启动器角色').replaceAll('QQ 人格：','角色：').replaceAll('桌面对话独立保存，不影响启动器 QQ 原有记录。','对话归属启动器中的此角色；本窗口显示本次聊天。').replaceAll("form.elements.chatEndpoint.value=currentSettings.chatEndpoint;","form.elements.chatEndpoint.value='';form.elements.chatEndpoint.disabled=true;");await fs.writeFile(chatFile,chat);
const htmlFile=path.join(appRoot,'renderer','chat.html');let html=await fs.readFile(htmlFile,'utf8');html=html.replaceAll('自动 QQ 伙伴','启动器角色').replace('默认自动使用 QQ 伙伴的模型与人格。启动器无需运行；首次使用请先在启动器配置并保存。人物互动可离线使用。','由启动器管理此角色的模型、人格与固定对话。请保持启动器运行；人物互动不额外调用模型。').replace('通常留空即可。接入自己的聊天服务时，填写本机接口的完整地址。','此实例已绑定启动器角色，聊天地址由启动器管理。').replaceAll('留空自动使用 QQ 伙伴','由启动器管理').replaceAll('桌面对话独立保存，不影响启动器 QQ 原有记录。','对话归属启动器中的此角色；本窗口显示本次聊天。');await fs.writeFile(htmlFile,html);
html=html.replace('title="仅清除本应用的桌面对话" aria-label="清除桌面对话" disabled>清空</button>','title="仅清空本窗口显示，角色页固定对话会保留" aria-label="清空窗口" disabled>清空窗口</button>');await fs.writeFile(htmlFile,html);
await fs.writeFile(path.join(portable,'使用说明.txt'),'此模块由深蓝启动器的角色页面下载安装和开启。每个角色使用独立资料、端口和会话；不读取旧 QQ 聊天凭据。独立运行不会启动。MCP 提供六项动作/文字/语音接口，音频仅允许角色资料目录内 audio 子目录。\r\n');
const files=[];
async function inspect(directory){for(const name of (await fs.readdir(directory)).sort()){const filename=path.join(directory,name),stat=await fs.lstat(filename);if(stat.isDirectory())await inspect(filename);else if(stat.isFile()){const bytes=await fs.readFile(filename);files.push({path:path.relative(portable,filename).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}else throw Error('Package contains non-file resources');}}
await inspect(portable);
const manifest=JSON.stringify({schemaVersion:1,id:'character-pet-runtime',version,entry:'DeepBlueCompanionV02.exe',appRoot:'resources/app',source:'desktop-companion-0.2.0',managed:true,files},null,2);
await fs.writeFile(path.join(portable,'managed-pet.json'),manifest);
const manifestSha256=createHash('sha256').update(manifest).digest('hex'),unpackedBytes=files.reduce((sum,file)=>sum+file.bytes,0)+Buffer.byteLength(manifest);
const archive=path.join(target,`character-pet-runtime-${version}-win-x64.tar.gz`);
const packed=spawnSync('tar',['-czf',archive,'-C',portable,'.'],{windowsHide:true,encoding:'utf8'});if(packed.status!==0)throw Error('tar packaging failed: '+packed.stderr);
const bytes=await fs.readFile(archive),metadata={id:'character-pet-runtime',version,archive,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sha512:createHash('sha512').update(bytes).digest('hex'),manifestSha256,unpackedBytes,format:'tar.gz',requiredFiles:['DeepBlueCompanionV02.exe','resources/app/main/managed-entry.cjs','resources/app/main/managed-resources.cjs','resources/app/main/companion-mcp.cjs','resources/app/assets/manifest.json','managed-pet.json']};
await fs.writeFile(path.join(target,'module-metadata.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata,null,2));
