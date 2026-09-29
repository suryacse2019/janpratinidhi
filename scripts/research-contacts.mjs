import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
const dir='/tmp/janpratinidhi-contact-research';
await fs.mkdir(dir,{recursive:true});
if(process.argv[2]==='inventory') {
 dotenv.config({path:'apps/api/.env',quiet:true});
 try { await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:15000}); const rows=await mongoose.connection.collection('representatives').find({},{projection:{name:1,state:1,office:1,constituency:1,slug:1,contacts:1}}).toArray(); await fs.writeFile(`${dir}/inventory.json`,JSON.stringify(rows,null,2)); console.log('Inventory saved: '+rows.length); } finally {await mongoose.disconnect();}
} else {
 const url=process.argv[2], filename=process.argv[3];
 if(!url || !filename || !/^[\w.-]+$/.test(filename)) throw new Error('Usage: node scripts/research-contacts.mjs URL filename');
 const r=await fetch(url,{headers:{'User-Agent':'JanPratinidhi public office contact research','Accept':'application/json,text/html,*/*'},signal:AbortSignal.timeout(45000)});
 console.log(JSON.stringify({status:r.status,url,type:r.headers.get('content-type')}));
 if(!r.ok)process.exitCode=1; else {const data=await r.text();await fs.writeFile(`${dir}/${filename}`,data);console.log('Saved '+data.length+' characters');}
}
