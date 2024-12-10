const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { id } = event.queryStringParameters || {};
    if (!id) {
        return {
            statusCode: 400,
            body: "Missing 'id' query parameter.",
        };
    }

    try {
        const result = await dynamoDB.get({
            TableName: process.env.TABLE_NAME,
            Key: { id },
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify(result.Item || {}),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: `Error fetching item: ${error.message}`,
        };
    }
};
