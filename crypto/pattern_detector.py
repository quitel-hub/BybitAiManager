import pandas as pd

def detect_patterns(df):
    # Пример: Бычье поглощение
    df['bullish_engulfing'] = ((df['btc_close'] > df['btc_open'].shift(1)) & 
                               (df['btc_open'] < df['btc_close'].shift(1))).astype(int)
    
    # Пример: Медвежье поглощение
    df['bearish_engulfing'] = ((df['btc_close'] < df['btc_open'].shift(1)) & 
                               (df['btc_open'] > df['btc_close'].shift(1))).astype(int)
    
    # Пример: Пин-бар (молот) - тень в 2 раза больше тела
    body = abs(df['btc_close'] - df['btc_open'])
    lower_shadow = df[['btc_open', 'btc_close']].min(axis=1) - df['btc_low']
    df['hammer'] = (lower_shadow > 2 * body).astype(int)
    
    return df