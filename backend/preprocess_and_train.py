import pandas as pd
import numpy as np
import json
import pickle
import os
from sklearn.preprocessing import LabelEncoder
from sklearn.cluster import DBSCAN
import lightgbm as lgb

print("Loading raw dataset...")
df = pd.read_csv('jan to may police violation_anonymized791b166.csv')

# Handle missing values globally
df['police_station'] = df['police_station'].fillna('UNKNOWN').astype(str)
df['vehicle_type'] = df['vehicle_type'].fillna('UNKNOWN').astype(str)
df['location'] = df['location'].fillna('UNKNOWN').astype(str)
df['junction_name'] = df['junction_name'].fillna('No Junction').astype(str)

# 1. Temporal Features
print("Processing temporal features...")
df['created_datetime'] = pd.to_datetime(df['created_datetime'], format='mixed', utc=True)
df['hour'] = df['created_datetime'].dt.hour
df['day_of_week'] = df['created_datetime'].dt.dayofweek
df['month'] = df['created_datetime'].dt.month

# 2. Congestion Impact Score (CIS) Calculation
print("Calculating Congestion Impact Scores (CIS)...")

# W_size (Vehicle Footprint Weight)
vehicle_weights = {
    'SCOOTER': 0.2, 'MOTOR CYCLE': 0.2, 'MOPED': 0.2,
    'PASSENGER AUTO': 0.5, 'GOODS AUTO': 0.8,
    'CAR': 1.0, 'VAN': 1.0, 'MAXI-CAB': 1.2,
    'LGV': 1.8, 'PRIVATE BUS': 2.5, 'TANKER': 3.0, 'TRACTOR': 2.0, 'HCV': 3.0
}
df['w_size'] = df['vehicle_type'].map(vehicle_weights).fillna(1.0)

# W_type (Violation Severity Weight)
def parse_violation_types(val):
    if pd.isna(val):
        return []
    try:
        viols = json.loads(val)
        if isinstance(viols, list):
            return viols
        return [str(val)]
    except Exception:
        return [str(val)]

df['parsed_violations'] = df['violation_type'].apply(parse_violation_types)

violation_weights = {
    'DOUBLE PARKING': 3.0,
    'PARKING IN A MAIN ROAD': 2.5,
    'PARKING NEAR ROAD CROSSING': 2.0,
    'PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS': 2.0,
    'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC': 1.8,
    'WRONG PARKING': 1.5,
    'NO PARKING': 1.2,
    'PARKING ON FOOTPATH': 1.0,
    'DEFECTIVE NUMBER PLATE': 0.2,
    'REFUSE TO GO FOR HIRE': 0.1
}

def get_violation_weight(viols):
    if not viols:
        return 1.0
    weights = [violation_weights.get(v, 1.0) for v in viols]
    return max(weights)

df['w_type'] = df['parsed_violations'].apply(get_violation_weight)

# W_road (Road Class Weight based on location and junction)
def get_road_weight(row):
    location_text = str(row['location']).lower()
    junction = str(row['junction_name']).lower()
    
    # Critical junctions
    if junction != "no junction" and junction != "" and "btp" in junction:
        return 3.0
    # Metro Stations and Markets
    elif "metro station" in location_text or "market" in location_text:
        return 2.8
    # Main Arterials
    elif "main road" in location_text or "ring road" in location_text or "highway" in location_text or "flyover" in location_text:
        return 2.0
    # Local/residential
    elif "cross road" in location_text or "cross" in location_text or "layout" in location_text:
        return 0.8
    else:
        return 1.2

df['w_road'] = df.apply(get_road_weight, axis=1)

# CIS Formula
df['cis'] = df['w_size'] * df['w_type'] * df['w_road']

# 3. Congestion Cost Calculator (Indian Road Congress values)
df['delay_hours'] = df['cis'] * 0.25 # average 15 mins block multiplier
df['economic_loss_inr'] = df['delay_hours'] * 150.0 # Value of Time: 150 INR/hr
df['fuel_wasted_liters'] = df['delay_hours'] * 1.2 * 0.5
df['co2_wasted_kg'] = df['fuel_wasted_liters'] * 2.3

# Extract primary violation for encoding
df['primary_violation'] = df['parsed_violations'].apply(lambda x: x[0] if len(x) > 0 else 'UNKNOWN')

# Fit LabelEncoders on full dataset to avoid unseen label issues
print("Fitting encoders on complete dataset...")
le_vehicle = LabelEncoder()
le_vehicle.fit(df['vehicle_type'])

le_station = LabelEncoder()
le_station.fit(df['police_station'])

le_viol = LabelEncoder()
le_viol.fit(df['primary_violation'])

df['vehicle_type_enc'] = le_vehicle.transform(df['vehicle_type'])
df['police_station_enc'] = le_station.transform(df['police_station'])
df['primary_violation_enc'] = le_viol.transform(df['primary_violation'])

# 4. Train LightGBM Validation Predictor (Noise Filter)
print("Training Validation Predictor (LightGBM)...")
# Labeled dataset for validation status
labeled_df = df[df['validation_status'].isin(['approved', 'rejected'])].copy()
labeled_df['target'] = (labeled_df['validation_status'] == 'approved').astype(int)

if len(labeled_df) > 0:
    # Train test split (fast 80/20)
    train_df = labeled_df.sample(frac=0.8, random_state=42)
    val_df = labeled_df.drop(train_df.index)
    
    features = ['hour', 'day_of_week', 'month', 'w_size', 'w_type', 'w_road', 
                'vehicle_type_enc', 'police_station_enc', 'primary_violation_enc']
    
    train_data = lgb.Dataset(train_df[features], label=train_df['target'])
    val_data = lgb.Dataset(val_df[features], label=val_df['target'], reference=train_data)
    
    params = {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'boosting_type': 'gbdt',
        'learning_rate': 0.05,
        'num_leaves': 31,
        'verbose': -1,
        'random_state': 42
    }
    
    model = lgb.train(
        params,
        train_data,
        num_boost_round=100,
        valid_sets=[val_data]
    )
    
    # Predict on the full dataset
    df['approval_probability'] = model.predict(df[features])
    
    # Save encoders and model
    with open('encoders_and_model.pkl', 'wb') as f:
        pickle.dump({
            'model': model,
            'le_vehicle': le_vehicle,
            'le_station': le_station,
            'le_viol': le_viol,
            'features': features
        }, f)
    print("Saved Validation Predictor model and encoders.")
else:
    print("No labeled validation status rows found. Using default probability.")
    df['approval_probability'] = 0.85

# 5. Spatial-Temporal Clustering (Hotspot Detection)
print("Running Spatial DBSCAN to generate Hotspots...")
# Filter for approved/high-probability violations to find true congestion centers
high_impact_df = df[(df['approval_probability'] >= 0.7) & (df['cis'] >= 1.5)].copy()

# Sample to 60k for robust and fast DBSCAN execution
if len(high_impact_df) > 60000:
    high_impact_df = high_impact_df.sample(n=60000, random_state=42)

coords = high_impact_df[['latitude', 'longitude']].values
db = DBSCAN(eps=0.0015, min_samples=15, metric='euclidean', n_jobs=-1)
high_impact_df['cluster_label'] = db.fit_predict(coords)

print(f"Generated {high_impact_df['cluster_label'].nunique() - 1} hotspots.")

# Map clusters back to the main dataframe
df = df.merge(high_impact_df[['id', 'cluster_label']], on='id', how='left')
df['cluster_label'] = df['cluster_label'].fillna(-1).astype(int)

# 6. Save preprocessed dataset
keep_cols = [
    'id', 'latitude', 'longitude', 'location', 'vehicle_type', 'violation_type',
    'created_datetime', 'police_station', 'junction_name', 'validation_status',
    'hour', 'day_of_week', 'month', 'cis', 'delay_hours', 'economic_loss_inr',
    'fuel_wasted_liters', 'co2_wasted_kg', 'approval_probability', 'cluster_label',
    'w_size', 'w_type', 'w_road'
]
df_save = df[keep_cols]

df_save.to_pickle('preprocessed_data.pkl')
print(f"Preprocessing complete. Saved {len(df_save)} rows to 'preprocessed_data.pkl'.")
