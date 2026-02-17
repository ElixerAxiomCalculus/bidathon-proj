
import yfinance as yf

def test_yfinance():
    print("Testing yfinance...")
    try:
        ticker = "RELIANCE.NS"
        stock = yf.Ticker(ticker)
        info = stock.info
        print(f"Success! Name: {info.get('shortName')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_yfinance()
