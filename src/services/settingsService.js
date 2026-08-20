const settingsModel=require('../models/settingsModel');

async function resolve(dbKey,envVarName){
    const dbValue = await settingsModel.get(dbKey);
    if (dbValue) return dbValue;
    return process.env[envVarName] || null;
}
module.exports = { resolve };
