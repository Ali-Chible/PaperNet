require('dotenv').config({quiet:true});
const { Pool } = require('pg') ;
const pgvector=require('pgvector/pg');

const pool = new Pool({
    connectionString : process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis:0,
});
pool.on('connect',()=>{
    console.log('db new connection');
});
pool.on('error',(err)=>{
    console.error('Postgres pool error',err.message);
    readyPromise=null;
});
let readyPromise = null;
function whenReady(){
    if(!readyPromise){
        readyPromise=pool.connect().then(async (client)=>{
            await pgvector.registerTypes(client);
            client.release();
        });
    }
        return readyPromise;

}

const rawQuery = pool.query.bind(pool);
pool.query = async (...args)=>{
    await whenReady();
    return rawQuery(...args);
};
module.exports=pool;