import express from 'express';
import request from 'request';

const app = express();
const port = 80;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ECS!' });
});

// aims to call the lambda function
app.get('/api', (req, res) => {
  request({
    uri: process.env.APIGATEWAY_URL,
    // qs: {
    //   api_key: '123456',
    //   query: 'World of Warcraft: Legion'
    // }
  }).pipe(res);
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});