import pandas as pd
import json
import numpy as np
import xgboost as xgb
import joblib
import warnings
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

warnings.filterwarnings('ignore')
print("🧠 Инициализация нейро-модуля (Clean Multi-Market Edition)...")

# --- 1. ЗАГРУЗКА И ПОДГОТОВКА ---
def load_and_prep(filename, prefix):
    with open(filename, 'r') as f:
        df = pd.DataFrame(json.load(f))
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    df = df.rename(columns={
        'open': f'{prefix}_open', 
        'close': f'{prefix}_close', 
        'volume': f'{prefix}_vol', 
        'high': f'{prefix}_high', 
        'low': f'{prefix}_low'
    })
    return df[['timestamp', f'{prefix}_open', f'{prefix}_close', f'{prefix}_vol', f'{prefix}_high', f'{prefix}_low']]

print("📂 Чтение файлов...")
df_btc_15m = load_and_prep('dataset_btc_15m.json', 'btc')
df_btc_4h = load_and_prep('dataset_btc_4h.json', 'btc_4h')
df_eth_15m = load_and_prep('dataset_eth_15m.json', 'eth')

# --- 2. СЛИЯНИЕ ДАННЫХ ---
df = pd.merge(df_btc_15m, df_eth_15m[['timestamp', 'eth_close', 'eth_vol']], on='timestamp', how='left')
df = pd.merge_asof(df, df_btc_4h[['timestamp', 'btc_4h_close']], on='timestamp', direction='backward')

print("⚙️ Рассчитываем чистые метрики...")

# Базовые фичи
df['price_change_%'] = df['btc_close'].pct_change() * 100
df['volatility'] = df['btc_high'] - df['btc_low']

# Кросс-рыночные фичи
df['eth_change_%'] = df['eth_close'].pct_change() * 100 
df['btc_4h_change_%'] = df['btc_4h_close'].pct_change() * 100 
df['btc_to_eth_ratio'] = df['btc_close'] / df['eth_close'] 

# Индикаторы
exp1 = df['btc_close'].ewm(span=12, adjust=False).mean()
exp2 = df['btc_close'].ewm(span=26, adjust=False).mean()
df['macd'] = exp1 - exp2
df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()

delta = df['btc_close'].diff()
gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
df['rsi_14'] = 100 - (100 / (1 + gain / loss))

# Цель: вырастет ли следующая 15m свеча BTC?
df['target'] = (df['btc_close'].shift(-1) > df['btc_close']).astype(int)

# Очистка
df = df.replace([np.inf, -np.inf], np.nan).dropna()

print("🚀 Обучаем XGBoost...")

# Чистый список признаков (без паттернов)
features = [
    'price_change_%', 'volatility', 'rsi_14', 'macd', 'macd_signal',
    'eth_change_%', 'btc_4h_change_%', 'btc_to_eth_ratio'
]

X = df[features]
y = df['target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

model = xgb.XGBClassifier(
    n_estimators=300, learning_rate=0.05, max_depth=5, 
    subsample=0.8, colsample_bytree=0.8, random_state=42
)

model.fit(X_train, y_train)
accuracy = accuracy_score(y_test, model.predict(X_test))

print("="*40)
print(f"🎯 Финальная боевая точность (Accuracy): {accuracy * 100:.2f}%")
print("="*40)

joblib.dump(model, 'trading_brain.pkl')
print("✅ Мозг готов к суточному марафону!")