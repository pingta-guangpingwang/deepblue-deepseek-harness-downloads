'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const SCHEME='deepblue-pet',ORIGIN=SCHEME+'://app';
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
function validRelative(relative){const parts=relative.split('/');return ['renderer','assets'].includes(parts[0])&&parts.length>1&&parts.every(p=>p!=='.'&&p!=='..'&&/^[0-9A-Za-z._-]+$/.test(p))&&Object.hasOwn(MIME,path.extname(relative));}
function resourceURL(root,file){const relative=path.relative(path.resolve(root),path.resolve(file)).split(path.sep).join('/');if(!validRelative(relative))throw Error('资源不属于桌宠素材目录');return ORIGIN+'/'+relative;}
function registerResourceScheme(protocol){protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);}
function createResourceHandler(appRoot){const root=path.resolve(appRoot);return async request=>{
 if(request.method!=='GET')return new Response(null,{status:405});
 try{const url=new URL(request.url);if(url.protocol!==SCHEME+':'||url.hostname!=='app'||url.port||url.username||url.password||url.search||url.hash||/%(?:2e|2f|5c|00)/i.test(url.pathname))throw Error('Invalid URL');const relative=decodeURIComponent(url.pathname.slice(1));if(!validRelative(relative))throw Error('Invalid path');
  let target=root;const rootStat=await fs.lstat(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw Error('Unsafe root');const parts=relative.split('/');for(let i=0;i<parts.length;i++){target=path.join(target,parts[i]);const stat=await fs.lstat(target);if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()||stat.size>32*1024*1024))throw Error('Unsafe resource');}
  const bytes=await fs.readFile(target);return new Response(bytes,{status:200,headers:{'Content-Type':MIME[path.extname(target)],'Content-Length':String(bytes.length),'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch{return new Response(null,{status:404});}
};}
async function installResourceProtocol(protocol,root){await protocol.handle(SCHEME,createResourceHandler(root));return file=>resourceURL(root,file);}
module.exports={SCHEME,resourceURL,registerResourceScheme,createResourceHandler,installResourceProtocol};
