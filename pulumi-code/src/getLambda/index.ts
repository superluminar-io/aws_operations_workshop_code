import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// Sleep function to pause execution for a specified duration
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Pause execution for 5 seconds
    await sleep(5000);

    // Return a 200 status code with a message
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Lambda function executed successfully after 5 seconds."
        })
    };
};
