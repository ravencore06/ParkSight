import pandas as pd
import numpy as np
import json
import os
import csv
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

# 1. Global DB to hold static junction metadata (coords, vehicle mix, peak hours, etc.)
metadata_db = {}

def load_metadata():
    global metadata_db
    pkl_path = 'preprocessed_data.pkl'
    if not os.path.exists(pkl_path):
        pkl_path = os.path.join(os.path.dirname(__file__), 'preprocessed_data.pkl')
    
    if not os.path.exists(pkl_path):
        print(f"Warning: Preprocessed data file not found at {pkl_path}. Fallback data will be used.")
        return
        
    print(f"Loading preprocessed dataset from {pkl_path}...")
    try:
        df = pd.read_pickle(pkl_path)
        df_junctions = df[df['junction_name'] != 'No Junction'].copy()
        
        DAYS_BASELINE = 150
        grouped = df_junctions.groupby('junction_name')
        
        for name, group in grouped:
            total_violations = len(group)
            lat = float(group['latitude'].mean())
            lng = float(group['longitude'].mean())
            jurisdiction = str(group['police_station'].iloc[0])
            
            # Vehicle mix
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
            vehicle_mix = ", ".join(vehicle_mix_list[:3])
            sorted_vehicle_mix_data = sorted(vehicle_mix_data, key=lambda x: x['percentage'], reverse=True)[:5]
            
            # Peak hour
            hour_counts = group['hour'].value_counts()
            peak_hour = int(hour_counts.index[0])
            peak_count = int(hour_counts.values[0])
            peak_hour_str = f"{peak_hour:02d}:00"
            
            # Trend data multipliers relative to group's average CIS
            trend_hours = [8, 10, 12, 14, 16, 18, 20]
            trend_multipliers = {}
            group_mean_cis = group['cis'].mean()
            for h in trend_hours:
                h_group = group[group['hour'] == h]
                if len(h_group) > 0 and group_mean_cis > 0:
                    trend_multipliers[h] = float(h_group['cis'].mean() / group_mean_cis)
                else:
                    trend_multipliers[h] = 0.8 if h in [8, 14, 20] else 1.1
            
            metadata_db[name] = {
                "jurisdiction": jurisdiction,
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "vehicle_mix": vehicle_mix,
                "vehicle_mix_data": sorted_vehicle_mix_data,
                "peak_hour": peak_hour_str,
                "peak_hour_val": peak_hour,
                "peak_hour_violations": peak_count,
                "trend_multipliers": trend_multipliers,
                "raw_cis_base": float(group_mean_cis),
                "economic_cost_base": int(group['economic_loss_inr'].sum() / DAYS_BASELINE),
                "co2_impact_base": int(group['co2_wasted_kg'].sum() / DAYS_BASELINE)
            }
        print(f"Successfully loaded metadata for {len(metadata_db)} junctions.")
    except Exception as e:
        print(f"Error reading preprocessed pkl: {e}")

# 2. API Endpoint
async def get_hotspots(request):
    csv_path = 'top_10_hotspots.csv'
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(__file__), 'top_10_hotspots.csv')
        
    if not os.path.exists(csv_path):
        return JSONResponse({"error": f"top_10_hotspots.csv not found at {csv_path}"}, status_code=404)
        
    hotspots = []
    try:
        # Dynamically read CSV file on each request
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                name = row.get('junction_name', '').strip()
                if not name:
                    continue
                
                # Retrieve violations and raw CIS from CSV
                raw_violations = int(row.get('violations', 0))
                raw_cis = float(row.get('cis', 0.0))
                csv_recommendation = row.get('recommendation', '').strip()
                
                # Fetch static metadata lookup
                meta = metadata_db.get(name, {
                    "jurisdiction": "Unknown",
                    "lat": 12.9716,
                    "lng": 77.5946,
                    "vehicle_mix": "SCOOTER (45%), CAR (20%)",
                    "vehicle_mix_data": [{"name": "SCOOTER", "percentage": 45.0}, {"name": "CAR", "percentage": 20.0}],
                    "peak_hour": "09:00",
                    "peak_hour_val": 9,
                    "peak_hour_violations": 100,
                    "trend_multipliers": {h: 1.0 for h in [8, 10, 12, 14, 16, 18, 20]},
                    "raw_cis_base": 1.0,
                    "economic_cost_base": 0,
                    "co2_impact_base": 0
                })
                
                # Calculate normalized CIS (0-10 scale derived from raw CIS)
                normalized_cis = min(10.0, round(raw_cis * 4.14, 1))
                
                # Recommendation logic based on normalized CIS
                if normalized_cis >= 8.0:
                    status = "critical"
                    action = "Tow Immediately"
                elif normalized_cis >= 5.0:
                    status = "active"
                    action = "Deploy Officers"
                else:
                    status = "neutral"
                    action = "Routine Patrol"
                
                # Calculate dynamic improvement percentage
                expected_improvement = min(50.0, round(normalized_cis * 5, 1))
                
                # Incident delay and stats
                DAYS_BASELINE = 150
                affected_vehicles = int(raw_violations / DAYS_BASELINE * 12)
                avg_delay = round(raw_cis * 2, 1)
                capacity_loss = min(95.0, round(normalized_cis * 4.5, 1))
                
                # Dynamically scale baseline costs/emissions to match raw_cis
                base_cis = meta.get("raw_cis_base", 1.0) or 1.0
                scale_ratio = raw_cis / base_cis
                
                if meta.get("economic_cost_base"):
                    economic_cost = int(meta["economic_cost_base"] * scale_ratio)
                else:
                    economic_cost = int(raw_violations * raw_cis * 0.25 * 150 / DAYS_BASELINE)
                    
                if meta.get("co2_impact_base"):
                    co2_impact = int(meta["co2_impact_base"] * scale_ratio)
                else:
                    co2_impact = int(raw_violations * raw_cis * 0.25 * 1.2 * 0.5 * 2.3 / DAYS_BASELINE)
                
                # Generate dynamic trend data
                trend_data = []
                for h in [8, 10, 12, 14, 16, 18, 20]:
                    mult = meta["trend_multipliers"].get(h, 1.0)
                    h_raw_cis = raw_cis * mult
                    h_norm_cis = min(10.0, round(h_raw_cis * 4.14, 1))
                    trend_data.append({
                        "name": f"{h:02d}:00",
                        "CIS": h_norm_cis
                    })
                
                hotspots.append({
                    "id": idx + 1,
                    "name": name,
                    "jurisdiction": meta["jurisdiction"],
                    "violations": raw_violations,
                    "raw_cis": raw_cis,
                    "cis": normalized_cis,
                    "status": status,
                    "action": action,
                    "recommendation": csv_recommendation or action,
                    "expected_improvement": expected_improvement,
                    "vehicle_mix": meta["vehicle_mix"],
                    "vehicle_mix_data": meta["vehicle_mix_data"],
                    "peak_hour": meta["peak_hour"],
                    "peak_hour_val": meta["peak_hour_val"],
                    "peak_hour_violations": meta["peak_hour_violations"],
                    "affected_vehicles": affected_vehicles,
                    "avg_delay": avg_delay,
                    "capacity_loss": capacity_loss,
                    "economic_cost": economic_cost,
                    "co2_impact": co2_impact,
                    "lat": meta["lat"],
                    "lng": meta["lng"],
                    "trend_data": trend_data
                })
    except Exception as e:
        print(f"Error serving hotspots: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
        
    return JSONResponse(hotspots)

# Load metadata once at server start
load_metadata()

# 3. Create Starlette App with routes & CORS middleware
routes = [
    Route("/api/hotspots", get_hotspots, methods=["GET"])
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
]

app = Starlette(debug=True, routes=routes, middleware=middleware)

if __name__ == "__main__":
    uvicorn.run("server:app", host="localhost", port=5000, reload=True)
