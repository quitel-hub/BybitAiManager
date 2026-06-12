import sys
import json
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb # Обязательно добавляем импорт XGBoost
import warnings

warnings.filterwarnings('ignore')

try:
    model = joblib.load('trading_brain.pkl')

    with open('current_market.json', 'r') as file:
        data = json.load(file)
    
    df = pd.DataFrame(data)
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df = df.sort_values('timestamp').reset_index(drop=True)

    # 1. Временные фичи
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek

    # 2. Базовые фичи
    df['price_change_%'] = df['close'].pct_change() * 100
    df['sma_5'] = df['close'].rolling(window=5).mean()
    df['sma_15'] = df['close'].rolling(window=15).mean()
    df['price_to_sma'] = df['close'] / df['sma_5']
    df['volume_change_%'] = df['volume'].pct_change() * 100
    df['volatility'] = df['high'] - df['low']

    # 3. RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi_14'] = 100 - (100 / (1 + rs))

    # 4. MACD
    exp1 = df['close'].ewm(span=12, adjust=False).mean()
    exp2 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = exp1 - exp2
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']

    # 5. Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=20).mean()
    df['bb_std'] = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_middle'] - 2 * df['bb_std']
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']

    # Очистка
    df = df.replace([np.inf, -np.inf], np.nan)
    
    # Берем последнюю свечу
    current_state = df.iloc[-1:]
    
    features = [
        'hour', 'day_of_week', 
        'price_change_%', 'sma_5', 'sma_15', 'price_to_sma', 
        'volume_change_%', 'volatility', 'rsi_14',
        'macd', 'macd_signal', 'macd_hist',
        'bb_width', 'bb_upper', 'bb_lower'
    ]
    
    X_current = current_state[features]

    prediction = model.predict(X_current)[0]

    # Для XGBoost иногда нужно явно привести к int, чтобы Node.js корректно прочитал "1" или "0"
    print(int(prediction))

except Exception as e:
    print(f"ERROR: {e}")