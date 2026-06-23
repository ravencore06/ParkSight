import pandas as pd
import numpy as np

# 1. Load the preprocessed dataset
df = pd.read_pickle('preprocessed_data.pkl')

# Filter out "No Junction" to focus on real named junctions
df_junctions = df[df['junction_name'] != 'No Junction'].copy()

# 2. Group by junction_name and calculate aggregates
grouped = df_junctions.groupby('junction_name')

results = []
for name, group in grouped:
    total_violations = len(group)
    
    # Calculate vehicle mix percentages
    vehicle_counts = group['vehicle_type'].value_counts()
    vehicle_mix_list = []
    for vt, count in vehicle_counts.items():
        pct = (count / total_violations) * 100
        vehicle_mix_list.append(f"{vt} ({pct:.1f}%)")
    vehicle_mix = ", ".join(vehicle_mix_list[:3]) # Top 3 vehicles
    
    # Peak hour violations
    hour_counts = group['hour'].value_counts()
    peak_hour = hour_counts.index[0]
    peak_count = hour_counts.values[0]
    peak_hour_str = f"{peak_hour:02d}:00 ({peak_count} violations)"
    
    # Average CIS
    avg_cis = group['cis'].mean()
    
    # Mean Lat/Lng
    lat = group['latitude'].mean()
    lng = group['longitude'].mean()
    
    # Recommendation logic based on average CIS
    # Adjusted thresholds to match the actual distribution of average CIS:
    # - >= 3.0: "Tow Immediately" (High density of heavy/severe violations on main arterials)
    # - >= 2.0: "Deploy Officers" (Medium severity congestion)
    # - < 2.0: "Routine Patrol" (Low severity/minor vehicle violations)
    if avg_cis >= 3.0:
        recommendation = "Tow Immediately"
    elif avg_cis >= 2.0:
        recommendation = "Deploy Officers"
    else:
        recommendation = "Routine Patrol"
        
    results.append({
        'junction_name': name,
        'violations': total_violations,
        'cis': round(avg_cis, 2),
        'vehicle_mix': vehicle_mix,
        'peak_hour_violations': peak_hour_str,
        'latitude': round(lat, 5),
        'longitude': round(lng, 5),
        'recommendation': recommendation
    })

# 3. Convert to DataFrame and sort by violations descending
results_df = pd.DataFrame(results)
top_10 = results_df.sort_values(by='violations', ascending=False).head(10)

# 4. Export full details for top 10
print("\n--- TOP 10 HOTSPOTS DETAILS ---")
for idx, row in top_10.iterrows():
    print(f"\nJunction: {row['junction_name']}")
    print(f"  Total Violations: {row['violations']}")
    print(f"  Average CIS: {row['cis']}")
    print(f"  Vehicle Mix: {row['vehicle_mix']}")
    print(f"  Peak Hour: {row['peak_hour_violations']}")
    print(f"  Coordinates: {row['latitude']}, {row['longitude']}")
    print(f"  Recommendation: {row['recommendation']}")

# 5. Export specified columns to CSV
export_df = top_10[['junction_name', 'violations', 'cis', 'recommendation']]
export_df.to_csv('top_10_hotspots.csv', index=False)
print("\nExported top 10 hotspots to 'top_10_hotspots.csv'.")
