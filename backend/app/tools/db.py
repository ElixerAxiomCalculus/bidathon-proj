from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load .env from the tools directory AND the backend root
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI not found in .env file")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['bidathon_db']


def save_to_db(data: dict) -> str:
    """Save scraped data to MongoDB. Returns the inserted document id."""
    collection = db['scraped_data']
    try:
        result = collection.insert_one(data)
        print("Data saved to MongoDB")
        return str(result.inserted_id)
    except Exception as e:
        print(f"Failed to save to MongoDB: {e}")
        raise


def get_all_scraped() -> list[dict]:
    """Fetch all scraped documents from MongoDB."""
    collection = db['scraped_data']
    docs = list(collection.find({}, {"_id": 0}))
    return docs


def get_scraped_by_url(url: str) -> dict | None:
    """Fetch a single scraped document by URL."""
    collection = db['scraped_data']
    doc = collection.find_one({"url": url}, {"_id": 0})
    return doc


def search_scraped(query: str, limit: int = 20) -> list[dict]:
    """Search scraped documents by title or URL substring."""
    collection = db['scraped_data']
    regex_filter = {
        "$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"url": {"$regex": query, "$options": "i"}},
        ]
    }
    docs = list(collection.find(regex_filter, {"_id": 0}).limit(limit))
    return docs


def delete_scraped_by_url(url: str) -> bool:
    """Delete a scraped document by URL. Returns True if deleted."""
    collection = db['scraped_data']
    result = collection.delete_one({"url": url})
    return result.deleted_count > 0


def get_db_stats() -> dict:
    """Get basic stats about the scraped_data collection."""
    collection = db['scraped_data']
    count = collection.count_documents({})
    return {"collection": "scraped_data", "document_count": count}
