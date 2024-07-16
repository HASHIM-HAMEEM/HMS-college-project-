
//dbconnect.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = 'mongodb://localhost:27017/';

const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client.db(process.env.DB_NAME);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

module.exports = { connectToDatabase, client };