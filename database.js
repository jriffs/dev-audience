const {MongoClient} = require('mongodb')
require('dotenv').config()
const uri = process.env.MONGO_DB_URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })

async function updateUser({client, db, collection, name, update}) {
    try {
        await client.connect()
        const result = await client.db(db).collection(collection).updateOne({ name: name }, { $set: update })
    
        console.log(`${result.matchedCount} document(s) matched the query criteria.`)
        console.log(`${result.modifiedCount} document(s) was/were updated.`)
        await client.close() 
    } catch (e) {
        console.error(e)
    }
}

async function getStoredUser({client, db, collection, Username}) {
    try {
        await client.connect()
        const user = await client.db(db).collection(collection).findOne({ name: Username })
        await client.close()
        return user
    } catch (error) {
        
    }
}

async function createUser({client, db, collection, newDoc}) {
    try {
        await client.connect()
        const result = await client.db(db).collection(collection).insertOne(newDoc)
        await client.close()
        if (result.insertedId) {
            let answer = 'successful'
            console.log(answer)
            return answer
        }
    } catch (e) {
        console.error(e)
    }
}

module.exports = { createUser, getStoredUser, updateUser, client }