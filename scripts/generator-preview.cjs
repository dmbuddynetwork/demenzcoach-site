// Local, noindex preview of the actual production Worker and its built assets.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{pathToFileURL}=require('node:url');
async function createPreviewServer({root=path.resolve(__dirname,'..'),port=0}={}){
 const worker=(await import(pathToFileURL(path.join(root,'cloudflare-worker.js')).href)).default;
 const config=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
 const first=JSON.parse(config.match(/"run_worker_first"\s*:\s*(\[[\s\S]*?\])/)[1].replace(/^\s*\/\/.*$/gm,''));
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ico':'image/x-icon','.xml':'application/xml','.txt':'text/plain'};
 const stats={worker:[],assets:[]};
 function assetFile(url){const rel=decodeURIComponent(new URL(url).pathname);if(rel.split('/').some(part=>part.startsWith('.')))return null;const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)||!types[path.extname(file)])return null;try{return fs.statSync(file).isFile()?file:null;}catch{return null;}}
 const env={ASSETS:{async fetch(url,request){const value=url instanceof Request?url.url:String(url),file=assetFile(value);stats.assets.push(new URL(value).pathname);return file?new Response(request?.method==='HEAD'?null:fs.readFileSync(file),{headers:{'Content-Type':types[path.extname(file)]}}):new Response('Not found',{status:404});}}};
 const server=http.createServer(async(req,res)=>{try{const url='http://'+req.headers.host+req.url,request=new Request(url,{method:req.method,headers:req.headers});const pathname=new URL(url).pathname;
 const force=first.some(pattern=>pattern.endsWith('*')?pathname.startsWith(pattern.slice(0,-1)):pathname===pattern);
 let response;if(force||!assetFile(url)){stats.worker.push(pathname);response=await worker.fetch(request,env);}else response=await env.ASSETS.fetch(url,request);
 const headers=Object.fromEntries(response.headers);headers['x-robots-tag']='noindex';headers['cache-control']='no-store';res.writeHead(response.status,headers);res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local preview error');}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return {server,origin:'http://127.0.0.1:'+server.address().port,stats,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={createPreviewServer};
if(require.main===module)createPreviewServer({port:Number(process.env.PORT||0)}).then(preview=>{console.log(JSON.stringify({origin:preview.origin,actualProductionWorker:true,noindex:true,pid:process.pid}));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await preview.close();process.exit(0);});}).catch(error=>{console.error(error);process.exitCode=1;});
