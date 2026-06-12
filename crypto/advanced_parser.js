require('dotenv').config();
const { RestClientV5 } = require('bybit-api');
const fs = require('fs');

const client = new RestClientV5({
    key: process.env.API_KEY,
    secret: process.env.API_SECRET,
    testnet: true,
});

async function fetchAndSave(symbol, interval, filename) {
    console.log(`⏳ Скачиваем ${symbol} (Таймфрейм: ${interval}m)...`);
    try {
        const response = await client.getKline({
            category: 'linear',
            symbol: symbol,
            interval: interval,
            limit: 1000,
        });

        if (response.retCode === 0) {
            const data = response.result.list.map(c => ({
                timestamp: parseInt(c[0]),
                open: parseFloat(c[1]), high: parseFloat(c[2]),
                low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
            }));
            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
            console.log(`✅ Сохранено в ${filename}`);
        } else {
            console.error('❌ Ошибка биржи:', response.retMsg);
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error.message);
    }
}

async function runParser() {
    console.log('🚀 Запуск продвинутого парсера данных...');
    // 1. Базовый график (BTC 15 минут)
    await fetchAndSave('BTCUSDT', '15', 'dataset_btc_15m.json');
    // 2. Старший тренд (BTC 4 часа = 240 минут)
    await fetchAndSave('BTCUSDT', '240', 'dataset_btc_4h.json');
    // 3. График-поводырь (ETH 15 минут)
    await fetchAndSave('ETHUSDT', '15', 'dataset_eth_15m.json');
    console.log('🎉 Все данные успешно собраны! Можно обучать ИИ.');
}

runParser();