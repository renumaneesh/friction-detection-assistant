import argparse
import json
import os
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from faker import Faker

# We'll use absolute imports to run this script as a module if needed,
# or we can just import from db assuming PYTHONPATH includes backend/
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import SessionLocal, engine, Base
from db.models import Customer, Product, Session, Event, Feedback

fake = Faker()

def generate_products(n=40):
    categories = {
        'Electronics': (50.0, 500.0),
        'Apparel': (10.0, 150.0),
        'Home': (20.0, 300.0),
        'Beauty': (5.0, 80.0),
        'Grocery': (5.0, 50.0),
        'Sports': (20.0, 200.0)
    }
    products = []
    for _ in range(n):
        cat = random.choice(list(categories.keys()))
        min_p, max_p = categories[cat]
        price = round(random.uniform(min_p, max_p), 2)
        products.append({
            'id': str(uuid.uuid4()),
            'name': fake.ecommerce_name() if hasattr(fake, 'ecommerce_name') else f"{fake.word().capitalize()} {cat}",
            'category': cat,
            'price': float(price)
        })
    return products

def generate_customers(n=180):
    customers = []
    for _ in range(n):
        customers.append({
            'id': str(uuid.uuid4()),
            'name': fake.name(),
            'email': fake.unique.email(),
            'created_at': fake.date_time_between(start_date='-60d', end_date='-31d').isoformat()
        })
    return customers

def get_feedback(sentiment):
    phrases = {
        'positive': ["Great experience, very fast!", "Loved the product selection.", "Smooth checkout process.", "Will buy again!"],
        'neutral': ["It was okay.", "Nothing special, just average.", "Found what I needed.", "Standard shopping experience."],
        'negative': ["Checkout kept failing, very frustrating.", "Why is shipping so slow?", "My card was declined twice for no reason!", "Too expensive.", "Could not find delivery info easily."]
    }
    return random.choice(phrases[sentiment])

def generate_data():
    random.seed(42)
    Faker.seed(42)

    products = generate_products(40)
    customers = generate_customers(180)

    sessions = []
    
    profiles = ['happy_path', 'cart_abandoned', 'payment_friction', 'hesitation', 'delivery_concern']
    weights = [35, 20, 15, 15, 15]
    
    total_revenue = Decimal('0.00')
    
    for _ in range(300):
        customer = random.choice(customers)
        profile = random.choices(profiles, weights=weights, k=1)[0]
        
        session_id = str(uuid.uuid4())
        device_type = random.choice(['mobile', 'desktop', 'tablet'])
        
        # Start time in the last 30 days
        started_at = fake.date_time_between(start_date='-30d', end_date='now')
        current_time = started_at
        
        events = []
        purchased = False
        
        def add_event(evt_type, dt, metadata):
            events.append({
                'id': str(uuid.uuid4()),
                'session_id': session_id,
                'event_type': evt_type,
                'timestamp': dt.isoformat(),
                'metadata': metadata
            })
            
        product = random.choice(products)
        
        if profile == 'happy_path':
            duration = random.randint(10, 120)
            add_event('view', current_time, {"page": "product", "product_id": product['id'], "duration_seconds": duration})
            current_time += timedelta(seconds=duration + random.randint(10, 60))
            
            qty = random.randint(1, 3)
            add_event('cart_add', current_time, {"product_id": product['id'], "quantity": qty})
            current_time += timedelta(seconds=random.randint(30, 120))
            
            order_total = Decimal(str(product['price'])) * qty
            add_event('purchase', current_time, {"order_total": float(order_total), "product_ids": [product['id']]})
            current_time += timedelta(seconds=random.randint(5, 30))
            
            total_revenue += order_total
            purchased = True
            
        elif profile == 'cart_abandoned':
            duration = random.randint(10, 120)
            add_event('view', current_time, {"page": "product", "product_id": product['id'], "duration_seconds": duration})
            current_time += timedelta(seconds=duration + random.randint(10, 60))
            
            qty = random.randint(1, 2)
            add_event('cart_add', current_time, {"product_id": product['id'], "quantity": qty})
            
            # Gap of 30-90 minutes
            current_time += timedelta(minutes=random.randint(30, 90))
            add_event('abandon', current_time, {})
            
        elif profile == 'payment_friction':
            duration = random.randint(10, 120)
            add_event('view', current_time, {"page": "product", "product_id": product['id'], "duration_seconds": duration})
            current_time += timedelta(seconds=duration + random.randint(10, 60))
            
            qty = random.randint(1, 2)
            add_event('cart_add', current_time, {"product_id": product['id'], "quantity": qty})
            current_time += timedelta(seconds=random.randint(30, 120))
            
            order_total = float(Decimal(str(product['price'])) * qty)
            
            # Attempt 1
            add_event('payment_attempt', current_time, {"amount": order_total, "error_code": None})
            current_time += timedelta(seconds=random.randint(5, 30))
            add_event('payment_fail', current_time, {"amount": order_total, "error_code": "INSUFFICIENT_FUNDS"})
            current_time += timedelta(seconds=random.randint(30, 120))
            
            # Attempt 2
            add_event('payment_attempt', current_time, {"amount": order_total, "error_code": None})
            current_time += timedelta(seconds=random.randint(5, 30))
            add_event('payment_fail', current_time, {"amount": order_total, "error_code": "DECLINED"})
            
            if random.random() < 0.5:
                current_time += timedelta(seconds=random.randint(30, 120))
                add_event('payment_attempt', current_time, {"amount": order_total, "error_code": None})
                current_time += timedelta(seconds=random.randint(5, 15))
                add_event('purchase', current_time, {"order_total": order_total, "product_ids": [product['id']]})
                total_revenue += Decimal(str(order_total))
                purchased = True
            else:
                current_time += timedelta(minutes=random.randint(5, 10))
                add_event('abandon', current_time, {})
                
        elif profile == 'hesitation':
            views = random.randint(1, 3)
            for _ in range(views):
                duration = random.randint(300, 900)
                add_event('view', current_time, {"page": "product", "product_id": product['id'], "duration_seconds": duration})
                current_time += timedelta(seconds=duration + random.randint(10, 60))
            
            current_time += timedelta(minutes=random.randint(1, 5))
            add_event('abandon', current_time, {})
            
        elif profile == 'delivery_concern':
            duration = random.randint(10, 60)
            add_event('view', current_time, {"page": "product", "product_id": product['id'], "duration_seconds": duration})
            current_time += timedelta(seconds=duration + random.randint(30, 120))
            
            add_event('view', current_time, {"page": "delivery_info", "product_id": None, "duration_seconds": random.randint(30, 120)})
            current_time += timedelta(seconds=random.randint(30, 120))
            
            add_event('view', current_time, {"page": "delivery_info", "product_id": None, "duration_seconds": random.randint(30, 120)})
            current_time += timedelta(minutes=random.randint(1, 5))
            add_event('abandon', current_time, {})

        ended_at = current_time
        
        # Feedback logic
        feedback = None
        if profile in ['payment_friction', 'cart_abandoned']:
            rand_val = random.random()
            if rand_val < 0.40:
                sentiment = 'negative'
            elif rand_val < 0.50:
                sentiment = 'neutral'
            else:
                sentiment = None
        else:
            rand_val = random.random()
            if rand_val < 0.20:
                sentiment = 'positive'
            elif rand_val < 0.30:
                sentiment = 'neutral'
            else:
                sentiment = None
                
        if sentiment:
            feedback = {
                'id': str(uuid.uuid4()),
                'session_id': session_id,
                'text': get_feedback(sentiment),
                'sentiment': sentiment,
                'created_at': (ended_at + timedelta(minutes=random.randint(1, 60))).isoformat()
            }
            
        sessions.append({
            'id': session_id,
            'customer_id': customer['id'],
            'started_at': started_at.isoformat(),
            'ended_at': ended_at.isoformat(),
            'device_type': device_type,
            'events': events,
            'feedback': feedback,
            '_profile': profile # Internal tracking for summary
        })
        
    return customers, products, sessions, total_revenue

def save_to_db(customers, products, sessions):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Truncate
        db.execute(Event.__table__.delete())
        db.execute(Feedback.__table__.delete())
        db.execute(Session.__table__.delete())
        db.execute(Product.__table__.delete())
        db.execute(Customer.__table__.delete())
        db.commit()
        
        # Insert customers
        db.bulk_insert_mappings(Customer, customers)
        
        # Insert products
        db.bulk_insert_mappings(Product, products)
        
        # Insert sessions, events, feedback
        session_rows = []
        event_rows = []
        feedback_rows = []
        
        for s in sessions:
            session_rows.append({
                'id': s['id'],
                'customer_id': s['customer_id'],
                'started_at': s['started_at'],
                'ended_at': s['ended_at'],
                'device_type': s['device_type']
            })
            for e in s['events']:
                event_rows.append({
                    'id': e['id'],
                    'session_id': e['session_id'],
                    'event_type': e['event_type'],
                    'timestamp': e['timestamp'],
                    'event_metadata': e['metadata']
                })
            if s['feedback']:
                feedback_rows.append({
                    'id': s['feedback']['id'],
                    'session_id': s['feedback']['session_id'],
                    'text': s['feedback']['text'],
                    'sentiment': s['feedback']['sentiment'],
                    'created_at': s['feedback']['created_at']
                })
                
        db.bulk_insert_mappings(Session, session_rows)
        db.bulk_insert_mappings(Event, event_rows)
        db.bulk_insert_mappings(Feedback, feedback_rows)
        
        db.commit()
        print("Successfully saved to database.")
    except Exception as e:
        db.rollback()
        print(f"Error saving to DB: {e}")
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['db', 'json'], default='json', help="Output mode (db or json)")
    args = parser.parse_args()
    
    print("Generating synthetic data...")
    customers, products, sessions, total_revenue = generate_data()
    
    if args.mode == 'json':
        out_dir = os.path.join(os.path.dirname(__file__), 'output')
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, 'synthetic_data.json')
        
        # Clean up internal fields
        export_sessions = []
        for s in sessions:
            s_copy = dict(s)
            del s_copy['_profile']
            export_sessions.append(s_copy)
            
        data = {
            "customers": customers,
            "products": products,
            "sessions": export_sessions
        }
        with open(out_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Successfully saved to {out_path}")
    else:
        save_to_db(customers, products, sessions)
        
    # Validation Output
    total_sessions = len(sessions)
    profile_counts = {}
    total_feedback = 0
    negative_feedback = 0
    
    for s in sessions:
        prof = s['_profile']
        profile_counts[prof] = profile_counts.get(prof, 0) + 1
        if s['feedback']:
            total_feedback += 1
            if s['feedback']['sentiment'] == 'negative':
                negative_feedback += 1
                
    print("\n--- Validation Summary ---")
    print(f"Total Sessions: {total_sessions}")
    for prof, count in profile_counts.items():
        pct = (count / total_sessions) * 100
        print(f"  {prof}: {count} ({pct:.1f}%)")
    print(f"Sessions with Feedback: {total_feedback} ({(total_feedback/total_sessions)*100:.1f}%)")
    print(f"Negative Feedback: {negative_feedback} ({(negative_feedback/total_sessions)*100:.1f}%)")
    print(f"Total Revenue Represented: ${total_revenue:,.2f}")
    print("--------------------------\n")

if __name__ == '__main__':
    main()
