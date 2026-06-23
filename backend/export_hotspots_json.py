import pandas as pd
import numpy as np
import json
import os

# 1. Load the preprocessed dataset
pkl_path = 'preprocessed_data.pkl'
if not os.path.exists(pkl_path):
    pkl_path = r'c:\Users\srini\Documents\Hackathons\Gridlock-flipkart\Round 2\backend\preprocessed_data.pkl'

print(f"Loading preprocessed data from {pkl_path}...")
df = pd.read_pickle(pkl_path)

# Filter out "No Junction" records
df_junctions = df[df['junction_name'] != 'No Junction'].copy()

# 2. Group by junction_name and calculate metrics
grouped = df_junctions.groupby('junction_name')
hotspots = []

DAYS_BASELINE = 150

for idx, (name, group) in enumerate(grouped):
    total_violations = len(group)
    raw_cis = group['cis'].mean()
    
    # Calculate Normalized CIS: maps raw_cis 2.10 to exactly 8.7
    normalized_cis = min(10.0, round(raw_cis * 4.14, 1))
    
    # Recommendation/Action logic based on Normalized CIS
    if normalized_cis >= 8.0:
        recommendation = "Tow Immediately"
        status = "critical"
    elif normalized_cis >= 5.0:
        recommendation = "Deploy Officers"
        status = "active"
    else:
        recommendation = "Routine Patrol"
        status = "neutral"
        
    # Vehicle mix calculation (percentage and breakdown list for charts)
    vehicle_counts = group['vehicle_type'].value_counts()
    vehicle_mix_data = []
    vehicle_mix_list = []
    
    for vt, count in vehicle_counts.items():
        pct = (count / total_violations) * 100
        clean_vt = vt.replace("MOTOR CYCLE", "MOTORCYCLE").replace("PRIVATE BUS", "BUS")
        vehicle_mix_data.append({
            "name": clean_vt,
            "percentage": round(pct, 1)
        })
        vehicle_mix_list.append(f"{clean_vt} ({pct:.0f}%)")
        
    vehicle_mix = ", ".join(vehicle_mix_list[:3]) # Top 3 vehicles
    
    # Peak hour violations
    hour_counts = group['hour'].value_counts()
    peak_hour = int(hour_counts.index[0])
    peak_count = int(hour_counts.values[0])
    peak_hour_str = f"{peak_hour:02d}:00"
    
    # Daily impact rates
    affected_vehicles = int(total_violations / DAYS_BASELINE * 12)
    avg_delay = round(raw_cis * 2, 1)
    capacity_loss = min(95.0, round(normalized_cis * 4.5, 1))
    economic_cost = int(group['economic_loss_inr'].sum() / DAYS_BASELINE)
    co2_impact = int(group['co2_wasted_kg'].sum() / DAYS_BASELINE)
    
    # Expected improvement formula
    expected_improvement = min(50.0, round(normalized_cis * 5, 1))
    
    # hourly trend data for Recharts (Normalized CIS)
    trend_hours = [8, 10, 12, 14, 16, 18, 20]
    trend_data = []
    for h in trend_hours:
        h_group = group[group['hour'] == h]
        avg_h_cis = h_group['cis'].mean() if len(h_group) > 0 else raw_cis * (0.8 if h in [8, 14, 20] else 1.1)
        h_norm_cis = min(10.0, round(avg_h_cis * 4.14, 1))
        trend_data.append({
            "name": f"{h:02d}:00",
            "CIS": h_norm_cis
        })
        
    hotspots.append({
        "id": idx + 1,
        "name": name,
        "jurisdiction": group['police_station'].iloc[0],
        "violations": total_violations,
        "raw_cis": round(raw_cis, 3),
        "cis": normalized_cis,
        "status": status,
        "action": recommendation,             # Match App.jsx property name
        "recommendation": recommendation,     # Backwards compatibility
        "expected_improvement": expected_improvement, # Match App.jsx property name
        "vehicle_mix": vehicle_mix,
        "vehicle_mix_data": sorted(vehicle_mix_data, key=lambda x: x['percentage'], reverse=True)[:5],
        "peak_hour": peak_hour_str,
        "peak_hour_val": peak_hour,
        "peak_hour_violations": peak_count,
        "affected_vehicles": affected_vehicles,
        "avg_delay": avg_delay,
        "capacity_loss": capacity_loss,
        "economic_cost": economic_cost,
        "co2_impact": co2_impact,
        "lat": round(group['latitude'].mean(), 5),
        "lng": round(group['longitude'].mean(), 5),
        "trend_data": trend_data
    })

# 3. Sort hotspots by violations descending and re-assign IDs
hotspots = sorted(hotspots, key=lambda x: x['violations'], reverse=True)
for rank, hs in enumerate(hotspots):
    hs['id'] = rank + 1

# 4. Save to frontend/src/hotspots.json
output_path = r'c:\Users\srini\Documents\Hackathons\Gridlock-flipkart\Round 2\frontend\src\hotspots.json'
print(f"Exporting {len(hotspots)} hotspots to {output_path}...")

with open(output_path, 'w') as f:
    json.dump(hotspots, f, indent=2)

print("Export completed successfully.")
