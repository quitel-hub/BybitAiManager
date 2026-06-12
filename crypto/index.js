require('dotenv').config();
const { RestClientV5 } = require('bybit-api');
const { exec } = require('child_process');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api'); // Новая библиотека

const client = new RestClientV5({
    key: process.env.API_KEY,
    secret: process.env.API_SECRET,
    testnet: true,
});

// === ИНИЦИАЛИЗАЦИЯ TELEGRAM ===
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// === НАСТРОЙКИ БОТА ===
const TRADE_USDT = 10;      
const PROFIT_TARGET = 1.01; 
const DCA_DROP = 0.99;      
const CHECK_INTERVAL = 60 * 1000; 

// === ПАМЯТЬ БОТА (State) ===
let isPositionOpen = false; 
let averageBuyPrice = 0;    
let currentStep = 0;        
let totalBtcBought = 0;     
const MAX_STEPS = 3;        

// === СИСТЕМНЫЕ ПЕРЕМЕННЫЕ ===
let isBotRunning = false; 
let tradingTimer = null;

// === ИНТЕРФЕЙС TELEGRAM ===
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '▶️ Запустить анализ', callback_data: 'start' }],
            [{ text: '⏸️ Остановить анализ', callback_data: 'stop' }],
            [{ text: '💼 Статус портфеля', callback_data: 'status' }],
            [{ text: '🔄 Переобучить ИИ', callback_data: 'retrain' }]
        ]
    }
};

// Слушаем команду /start
bot.onText(/\/start/, (msg) => {
    // Защита: бот отвечает только тебе
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return; 
    bot.sendMessage(ADMIN_CHAT_ID, '👋 <b>Главный терминал управления алгоритмом</b>\n\nВыберите действие:', { parse_mode: 'HTML', ...mainMenu });
});

// Слушаем нажатия кнопок
bot.on('callback_query', (query) => {
    if (query.message.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const action = query.data;
    
    if (action === 'start') {
        if (!isBotRunning) {
            isBotRunning = true;
            bot.sendMessage(ADMIN_CHAT_ID, '▶️ <b>Алгоритм ЗАПУЩЕН!</b>\nБот перешел в фоновый режим мониторинга. Уведомления придут только при открытии сделок.', { parse_mode: 'HTML' });
            runTradingLoop(); // Делаем первый анализ сразу
            tradingTimer = setInterval(runTradingLoop, CHECK_INTERVAL);
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Бот уже работает!' });
        }
    } 
    else if (action === 'stop') {
        if (isBotRunning) {
            isBotRunning = false;
            clearInterval(tradingTimer);
            bot.sendMessage(ADMIN_CHAT_ID, '⏸️ <b>Алгоритм ОСТАНОВЛЕН.</b>\nМониторинг рынка прекращен.', { parse_mode: 'HTML' });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Бот уже остановлен!' });
        }
    }
    else if (action === 'status') {
        const statusMsg = `💼 <b>Текущий статус:</b>\n\n` +
                          `Мониторинг рынка: ${isBotRunning ? '🟢 Активен' : '🔴 Выключен'}\n` +
                          `Открытая позиция: ${isPositionOpen ? 'Да' : 'Нет'}\n` +
                          `Шаг DCA: ${currentStep} из ${MAX_STEPS}\n` +
                          `Вложено: ${currentStep * TRADE_USDT} USDT\n` +
                          `Средняя цена входа: ${averageBuyPrice.toFixed(2)} USDT\n` +
                          `Всего BTC: ${totalBtcBought.toFixed(5)}`;
        bot.sendMessage(ADMIN_CHAT_ID, statusMsg, { parse_mode: 'HTML' });
    }
    else if (action === 'retrain') {
        bot.sendMessage(ADMIN_CHAT_ID, '🔄 <b>Запуск переобучения ИИ...</b>\nСистема собирает данные и обновляет нейросеть. Ожидайте...', { parse_mode: 'HTML' });
        
        // Запускаем сборщик данных, а после него - мозг
        exec('node advanced_parser.js && python brain.py', (error, stdout, stderr) => {
            if (error) {
                bot.sendMessage(ADMIN_CHAT_ID, `❌ Ошибка обучения: ${error.message}`);
                return;
            }
            bot.sendMessage(ADMIN_CHAT_ID, '✅ <b>ИИ успешно переобучен на свежих данных!</b>', { parse_mode: 'HTML' });
        });
    }
    
    bot.answerCallbackQuery(query.id); // Убирает часики загрузки на кнопке
});


// === ЛОГИКА ТОРГОВЛИ ===
async function runTradingLoop() {
    try {
        const ticker = await client.getTickers({ category: 'spot', symbol: 'BTCUSDT' });
        const currentPrice = parseFloat(ticker.result.list[0].lastPrice);
        console.log(`[${new Date().toLocaleTimeString()}] Анализ... Текущая цена: ${currentPrice}`); // Оставил лог в консоли для тебя

        const klines = await client.getKline({ category: 'spot', symbol: 'BTCUSDT', interval: '15', limit: 30 }); // Увеличил лимит для правильного MACD
        const data = klines.result.list.map(c => ({
            timestamp: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));
        fs.writeFileSync('current_market.json', JSON.stringify(data, null, 2));

        if (!isPositionOpen) {
            exec('python predict.py', async (error, stdout) => {
                if (error) return console.error('Ошибка Python:', error.message);
                const aiSignal = stdout.trim();

                if (aiSignal === '1') {
                    await executeTrade('Buy', currentPrice, 'Сигнал ИИ XGBoost');
                }
                // Если 0 - бот просто молчит и ждет следующей минуты
            });
        } 
        else {
            if (currentPrice >= averageBuyPrice * PROFIT_TARGET) {
                await executeTrade('Sell', currentPrice, 'Тейк-Профит', true);
            } 
            else if (currentPrice <= averageBuyPrice * DCA_DROP && currentStep < MAX_STEPS) {
                await executeTrade('Buy', currentPrice, 'Усреднение DCA');
            }
        }
    } catch (error) {
        console.error('Ошибка цикла:', error);
        bot.sendMessage(ADMIN_CHAT_ID, `❌ <b>Ошибка скрипта:</b>\n${error.message}`, { parse_mode: 'HTML' });
    }
}

async function executeTrade(side, price, reason = '', isClosing = false) {
    try {
        const orderQty = side === 'Buy' ? TRADE_USDT.toString() : totalBtcBought.toFixed(5).toString();

        const response = await client.submitOrder({
            category: 'spot',
            symbol: 'BTCUSDT',
            side: side,
            orderType: 'Market',
            qty: orderQty,
        });

        if (response.retCode === 0) {
            if (side === 'Buy') {
                isPositionOpen = true;
                averageBuyPrice = currentStep === 0 ? price : (averageBuyPrice + price) / 2;
                currentStep++;
                
                const boughtBtc = (TRADE_USDT / price) * 0.999;
                totalBtcBought += boughtBtc;
                
                bot.sendMessage(ADMIN_CHAT_ID, `🟢 <b>ПОКУПКА (${reason})</b>\n\nЦена: ${price} USDT\nВложено: ${TRADE_USDT} USDT\nВсего BTC: ${totalBtcBought.toFixed(5)}`, { parse_mode: 'HTML' });
                
            } else if (side === 'Sell' && isClosing) {
                bot.sendMessage(ADMIN_CHAT_ID, `💰 <b>ПРОДАЖА (${reason})</b>\n\nЦена закрытия: ${price} USDT\n🎉 Цикл сделки успешно завершен!`, { parse_mode: 'HTML' });
                
                isPositionOpen = false;
                averageBuyPrice = 0;
                currentStep = 0;
                totalBtcBought = 0;
            }
        } else {
            bot.sendMessage(ADMIN_CHAT_ID, `❌ <b>ОШИБКА БИРЖИ</b>\n\n${response.retMsg}`, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('Ошибка отправки ордера:', error);
    }
}

console.log('Бот подключен к Telegram. Жду команду /start...');