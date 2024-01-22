import { Bot } from 'grammy';
import fetch from 'node-fetch';
import { createClient } from 'redis';
import { CronJob } from 'cron';
import 'dotenv/config';

const express = require('express');
const app = express();
app.listen(process.env.PORT || 3000);

const client = createClient({
  url: process.env.REDISCLOUD_URL,
  no_ready_check: true,
});
await client.connect();

client.on('error', (err) => console.log('Redis Client Error', err));

const bot = new Bot(process.env.TOKEN);

const chatId = '-1002086164925';
const subscribe = 'https://t.me/YaNewsUkraine';
const URL = `https://gnews.io/api/v4/top-headlines?category=general&lang=uk&apikey=${process.env.API_KEY}`;

const dataFetch = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
};

const saveToRedis = async (key, data) => {
  try {
    await client.set(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to Redis:', error.message);
  }
};

const getFromRedis = async (key) => {
  try {
    const data = await client.get(key);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting from Redis:', error.message);
  }
};

const sendToTelegramChannel = async (chatId, articles) => {
  console.log('articles:', articles);
  try {
    for (const article of articles) {
      const caption = `
      <b>${article.title}</b>\n\n${article.description} <u><a href="${article.url}">Детальніше...</a></u>
      \n\n<b><a href="${subscribe}">ПІДПИСАТИСЯ⬇️⬇️⬇️
      </a></b>\n`;

      await bot.api.sendPhoto(chatId, article.image, {
        caption,
        parse_mode: 'HTML',
      });
    }
  } catch (error) {
    console.error('Error sending to Telegram:', error.message);
  }
};

const updateNews = async () => {
  try {
    const allNews = await dataFetch(URL);
    const { articles } = allNews;
    const key = 'news';

    const previousNews = (await getFromRedis(key)) || [];

    const filteredNews = articles.filter(
      (article) =>
        !previousNews.some((prevArticle) => prevArticle.title === article.title)
    );

    if (filteredNews.length > 0) {
      await sendToTelegramChannel(chatId, filteredNews);

      await saveToRedis(key, articles);
    } else {
      console.log('No new news.');
    }
  } catch (error) {
    console.error('Error processing news command:', error.message);
  }
};

// process.on('SIGINT', async () => {
//   console.log('Received SIGINT. Closing Redis connection...');
//   await client.quit();
//   process.exit();
// });

console.log('Before job instantiation');

const job = new CronJob('0 */1 * * * *', async function () {
  console.log('Running scheduled job...');
  await updateNews();
});
console.log('After job instantiation');

job.start();
