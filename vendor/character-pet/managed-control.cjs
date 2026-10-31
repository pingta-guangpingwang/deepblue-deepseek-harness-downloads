'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function checkAudio(filename,profile) {
 if(typeof filename!=='string'||!path.isAbsolute(filename)||filename.replaceAll('\\','/').startsWith('//'))throw Error('语音文件需要放入此角色的 audio 目录。');
 const root=path.resolve(profile,'audio'),target=path.resolve(filename),relative=path.relative(root,target);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('语音文件不属于此角色。');
 for(let current=target;current!==path.dirname(root);current=path.dirname(current)){const stat=await fs.promises.lstat(current);if(stat.isSymbolicLink())throw Error('语音路径不能使用链接。');}
 if((await fs.promises.realpath(target)).toLowerCase()!==target.toLowerCase())throw Error('语音路径已重定向。');
}
async function createManagedControl(shell,{file,profile,roleId}) {
 const token=crypto.randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.headers.origin||req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end('{}');return;}
  if(req.method==='POST'&&req.url==='/shutdown'){res.end('{"ok":true}');setImmediate(()=>shell.quit());return;}
  if(req.method!=='POST'||req.url!=='/invoke'){res.writeHead(404);res.end('{}');return;}
  try {let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)throw Error('请求过长');body+=chunk;}
   const request=JSON.parse(body);if(request.arguments?.audioPath)await checkAudio(request.arguments.audioPath,profile);
   const value=await require('./control-api.cjs').invokeTool(shell,request.name,request.arguments);res.end(JSON.stringify(value));
  }catch{res.writeHead(400);res.end('{"error":"桌宠工具参数或资源不可用。"}');}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 fs.writeFileSync(file,JSON.stringify({pid:process.pid,roleId,url:`http://127.0.0.1:${server.address().port}`,token}),{mode:0o600});
 let closed=false;return {async close(){if(closed)return;closed=true;try{if(JSON.parse(fs.readFileSync(file,'utf8')).token===token)fs.unlinkSync(file);}catch{}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
module.exports={createManagedControl,checkAudio};
