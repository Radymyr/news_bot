import { Bot } from 'grammy';
import fetch from 'node-fetch';
import { createClient } from 'redis';
import { CronJob } from 'cron';
import 'dotenv/config';
const client = createClient({ url: process.env.REDIS_URL });

await client.connect();

client.on('error', (err) => console.log('Redis Client Error', err));

console.log('TOKEN:', process.env.TOKEN);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('API_KEY:', process.env.API_KEY);

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
  await client.set(key, JSON.stringify(data));
};

const getFromRedis = async (key) => {
  const data = await client.get(key);
  return JSON.parse(data);
};

const sendToTelegramChannel = async (chatId, articles) => {
  console.log('articles:', articles);

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

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing Redis connection...');
  await client.quit();
  process.exit();
});

console.log('Before job instantiation');

const job = new CronJob('0 */30 * * * *', async function () {
  console.log('Running scheduled job...');
  await updateNews();
});
console.log('After job instantiation');

job.start();
