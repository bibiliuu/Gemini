import requests
import threading
import time
import uuid
import random

# CONFIGURATION
API_URL = "http://47.236.4.240/api/transactions"
NUM_USERS = 20  # Simulate 20 concurrent users

def create_dummy_transaction(user_id):
    return {
        "id": str(uuid.uuid4()),
        "timestamp": int(time.time() * 1000),
        "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", # Tiny 1x1 pixel
        "status": "approved",
        "amount": random.randint(10, 100),
        "taker": f"User_{user_id}",
        "controller": "Controller_A",
        "superior": "Superior_B",
        "orderDate": "11.30",
        "content": f"Load Test Order from User {user_id}",
        "distribution": {
            "taker": 10,
            "controller": 2,
            "superior": 1,
            "pool": 5,
            "platform": 2
        }
    }

def simulate_user(user_id, results):
    try:
        # Each user submits a batch of 1 transaction
        payload = [create_dummy_transaction(user_id)]
        
        start_time = time.time()
        response = requests.post(API_URL, json=payload, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            print(f"✅ User {user_id}: Success ({duration:.2f}s)")
            results.append(True)
        else:
            print(f"❌ User {user_id}: Failed ({response.status_code}) - {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ User {user_id}: Error - {str(e)}")
        results.append(False)

def run_test():
    print(f"🚀 Starting Load Test with {NUM_USERS} concurrent users...")
    threads = []
    results = []

    # Launch threads
    for i in range(NUM_USERS):
        t = threading.Thread(target=simulate_user, args=(i, results))
        threads.append(t)
        t.start()

    # Wait for all to finish
    for t in threads:
        t.join()

    # Summary
    success_count = results.count(True)
    print("\n" + "="*30)
    print(f"Test Complete.")
    print(f"Successful Requests: {success_count}/{NUM_USERS}")
    print("="*30)

    if success_count == NUM_USERS:
        print("✅ SYSTEM IS STABLE under load.")
    else:
        print("⚠️  Some requests failed. Check server logs.")

if __name__ == "__main__":
    run_test()
