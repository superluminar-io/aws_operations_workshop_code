const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const body = JSON.parse(event.body || "{}");
    const { id, data } = body;

    if (!id || !data) {
        return {
            statusCode: 400,
            body: "Missing 'id' or 'data' in request body.",
        };
    }

    try {
        await dynamoDB.put({
            TableName: process.env.TABLE_NAME,
            Item: { id, data },
        }).promise();

        return {
            statusCode: 200,
            body: "Item successfully stored.",
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: `Error saving item: ${error.message}`,
        };
    }
};
