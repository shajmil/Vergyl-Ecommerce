var db = require('../config/database');
const storedProcedure = require('./stored-procedure');

async function startTransaction() {
    const pool = db.promise();
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
}

async function executeStoredProcedure(connection, procedureName, parameters) {
    try {
        const result = await new storedProcedure(procedureName, parameters, connection).result();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}
async function getmultipleSP(procedureName, parameters) {
    try {
        const [results, fields] = await db.promise().query(`CALL ${procedureName}(${parameters.map(() => '?').join(',')})`, parameters);
        return results;
    } catch (error) {
        throw error;
    }
}
async function executeTransaction(procedureName, parameters) {
    let connection;
    try {
        connection = await startTransaction();
        const result = await executeStoredProcedure(connection, procedureName, parameters);
        await connection.commit();
        connection.release();
        return result;
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        throw error;
    }
}

module.exports = {
    executeTransaction,
    getmultipleSP
};