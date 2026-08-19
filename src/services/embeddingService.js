require('dotenv').config({quiet:true});

const MODEL_NAME=process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

let extractorPromise=null;

async function getExtractor(){
    if(!extractorPromise){
        const {pipeline}=await import ('@huggingface/transformers');
        extractorPromise=pipeline('feature-extraction',MODEL_NAME);
    }
    return extractorPromise;
}

async function embedText(text){
    const extractor=await getExtractor();
    const output= await extractor(text,{pooling:'mean',normalize:true});
    return Array.from(output.data);
}
module.exports={embedText};