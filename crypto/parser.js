require('dotenv').config();
const { RestClientV5 } = require('bybit-api');
const fs = require('fs');

const client = new RestClientV5({
    key: process.env.API_KEY,
    secret: process.env.API_SECRET,
    testnet: true,
});

async function downloadHistory() {
    console.log('⏳ Начинаем скачивание истории графика BTCUSDT...');
    
    try {
        const response = await client.getKline({
            category: 'linear',
            symbol: 'BTCUSDT',
            interval: '15', // 15-минутные свечи
            limit: 1000,    // Берем 1000 последних свечей
        });

        if (response.retCode === 0) {
            const data = response.result.list;
            
            // Преобразуем данные в удобный формат (Время, Открытие, Максимум, Минимум, Закрытие, Объем)
            const formattedData = data.map(candle => ({
                timestamp: parseInt(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));

            // Сохраняем в JSON-файл
            fs.writeFileSync('dataset.json', JSON.stringify(formattedData, null, 2));
            console.log(`✅ Успешно сохранено ${formattedData.length} свечей в файл dataset.json!`);
        } else {
            console.error('❌ Ошибка от биржи:', response.retMsg);
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
    }
}

downloadHistory();