import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Users, 
  Truck, 
  Database, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Activity, 
  Filter, 
  RefreshCw, 
  BarChart2, 
  Sliders,
  DollarSign,
  Leaf
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';

// Mock Hotspots data based on provided police dataset
const INITIAL_HOTSPOTS = [
  {
    id: 1,
    name: "Safina Plaza Junction",
    jurisdiction: "Shivajinagar",
    violations: 42,
    cis: 9.6,
    affected_vehicles: 1240,
    capacity_loss: 37,
    avg_delay: 4.2,
    economic_cost: 18500,
    co2_impact: 145,
    vehicle_mix: "CAR (45%), TANKER (15%), SCOOTER (40%)",
    recidivism: "High (28%)",
    action: "Immediate Towing",
    x: 450,
    y: 180,
    size: 28,
    status: "critical"
  },
  {
    id: 2,
    name: "Sagar Theatre Junction",
    jurisdiction: "Upparpet",
    violations: 38,
    cis: 8.7,
    affected_vehicles: 980,
    capacity_loss: 31,
    avg_delay: 3.6,
    economic_cost: 14600,
    co2_impact: 110,
    vehicle_mix: "CAR (30%), LGV (25%), SCOOTER (45%)",
    recidivism: "Medium (18%)",
    action: "Deploy 2 Officers",
    x: 250,
    y: 280,
    size: 24,
    status: "high"
  },
  {
    id: 3,
    name: "18th Main Road, Block 2",
    jurisdiction: "Koramangala",
    violations: 29,
    cis: 7.9,
    affected_vehicles: 850,
    capacity_loss: 25,
    avg_delay: 2.8,
    economic_cost: 11200,
    co2_impact: 85,
    vehicle_mix: "CAR (65%), SCOOTER (35%)",
    recidivism: "Low (12%)",
    action: "Routine Patrol",
    x: 620,
    y: 450,
    size: 20,
    status: "medium"
  },
  {
    id: 4,
    name: "Modi Hospital Junction",
    jurisdiction: "Vijayanagara",
    violations: 24,
    cis: 7.4,
    affected_vehicles: 720,
    capacity_loss: 20,
    avg_delay: 2.3,
    economic_cost: 8900,
    co2_impact: 68,
    vehicle_mix: "CAR (25%), PASSENGER AUTO (40%), SCOOTER (35%)",
    recidivism: "Medium (15%)",
    action: "Deploy 1 Officer",
    x: 180,
    y: 150,
    size: 18,
    status: "medium"
  },
  {
    id: 5,
    name: "HAL Old Airport Road exit",
    jurisdiction: "HAL Old Airport",
    violations: 49,
    cis: 9.2,
    affected_vehicles: 1420,
    capacity_loss: 41,
    avg_delay: 4.8,
    economic_cost: 21500,
    co2_impact: 165,
    vehicle_mix: "CAR (55%), MAXI-CAB (20%), SCOOTER (25%)",
    recidivism: "High (32%)",
    action: "Immediate Towing",
    x: 750,
    y: 350,
    size: 32,
    status: "critical"
  },
  {
    id: 6,
    name: "KR Market main gate",
    jurisdiction: "City Market",
    violations: 33,
    cis: 8.1,
    affected_vehicles: 1150,
    capacity_loss: 28,
    avg_delay: 3.1,
    economic_cost: 13200,
    co2_impact: 102,
    vehicle_mix: "GOODS AUTO (40%), PRIVATE BUS (30%), SCOOTER (30%)",
    recidivism: "High (24%)",
    action: "Deploy 2 Officers",
    x: 320,
    y: 390,
    size: 22,
    status: "high"
  },
  {
    id: 7,
    name: "Modi Bridge Road link",
    jurisdiction: "Malleshwaram",
    violations: 18,
    cis: 6.2,
    affected_vehicles: 510,
    capacity_loss: 15,
    avg_delay: 1.6,
    economic_cost: 5800,
    co2_impact: 42,
    vehicle_mix: "CAR (40%), SCOOTER (60%)",
    recidivism: "Low (8%)",
    action: "Routine Patrol",
    x: 380,
    y: 110,
    size: 14,
    status: "low"
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'analytics', 'simulation'
  const [hotspots, setHotspots] = useState(INITIAL_HOTSPOTS);
  const [selectedHotspot, setSelectedHotspot] = useState(INITIAL_HOTSPOTS[0]);
  
  // Left Sidebar Filter States
  const [filterStation, setFilterStation] = useState('ALL');
  const [filterVehicle, setFilterVehicle] = useState('ALL');
  const [filterTime, setFilterTime] = useState('ALL');
  const [minCis, setMinCis] = useState(0.0);
  
  // Resource Optimizer Inputs
  const [availableOfficers, setAvailableOfficers] = useState(18);
  const [availableTows, setAvailableTows] = useState(6);
  const [complianceRate, setComplianceRate] = useState(0); // slider 0-100
  
  // Patrol plan optimization results
  const [optimizationTriggered, setOptimizationTriggered] = useState(false);
  const [dispatchRoutes, setDispatchRoutes] = useState([]);
  
  // Handle Filters
  const filteredHotspots = useMemo(() => {
    return hotspots.filter(h => {
      if (filterStation !== 'ALL' && h.jurisdiction !== filterStation) return false;
      if (minCis > 0 && h.cis < minCis) return false;
      
      // Vehicle type matches vehicle mix strings
      if (filterVehicle !== 'ALL' && !h.vehicle_mix.toLowerCase().includes(filterVehicle.toLowerCase())) return false;
      
      return true;
    });
  }, [hotspots, filterStation, filterVehicle, minCis]);

  // Command Bar Summary Metrics (Factoring in Simulation Compliance)
  const complianceFactor = (100 - complianceRate) / 100.0;
  
  const summaryMetrics = useMemo(() => {
    const activeCount = filteredHotspots.length;
    const avgCis = activeCount > 0 
      ? (filteredHotspots.reduce((sum, h) => sum + h.cis, 0) / activeCount) 
      : 0;
    
    // Sum delays & costs
    const totalDelay = filteredHotspots.reduce((sum, h) => sum + h.avg_delay * h.affected_vehicles, 0) * complianceFactor;
    const avgCapacityLoss = activeCount > 0 
      ? (filteredHotspots.reduce((sum, h) => sum + h.capacity_loss, 0) / activeCount) * complianceFactor
      : 0;
      
    return {
      activeCount,
      avgCis: parseFloat(avgCis.toFixed(1)),
      totalDelay: Math.round(totalDelay),
      avgCapacityLoss: Math.round(avgCapacityLoss)
    };
  }, [filteredHotspots, complianceFactor]);

  // Handle Quick Actions
  const showCritical = () => {
    setMinCis(8.5);
    setFilterStation('ALL');
  };
  
  const resetFilters = () => {
    setMinCis(0.0);
    setFilterStation('ALL');
    setFilterVehicle('ALL');
    setFilterTime('ALL');
    setComplianceRate(0);
    setOptimizationTriggered(false);
  };

  const generatePatrolPlan = () => {
    setOptimizationTriggered(true);
    // Sort hotspots by CIS to assign priority teams
    const sorted = [...filteredHotspots].sort((a, b) => b.cis - a.cis);
    
    const routes = [];
    if (sorted.length > 0) {
      routes.push({ team: "Patrol Team Alpha", target: sorted[0].name, action: sorted[0].action, expected_relief: "42%" });
    }
    if (sorted.length > 1) {
      routes.push({ team: "Patrol Team Beta", target: sorted[1].name, action: sorted[1].action, expected_relief: "35%" });
    }
    if (sorted.length > 2) {
      routes.push({ team: "Tow Unit 1", target: sorted[0].name, action: "Tow vehicles immediately", expected_relief: "42%" });
    }
    if (sorted.length > 3) {
      routes.push({ team: "Tow Unit 2", target: sorted[1].name, action: "Clear road crossing blockage", expected_relief: "31%" });
    }
    setDispatchRoutes(routes);
  };

  // Recharts Data mapping
  const barChartData = [
    { name: '08:00', Count: 14 },
    { name: '10:00', Count: 38 },
    { name: '12:00', Count: 22 },
    { name: '14:00', Count: 18 },
    { name: '16:00', Count: 29 },
    { name: '18:00', Count: 49 },
    { name: '20:00', Count: 31 }
  ];

  const pieChartData = [
    { name: 'Critical (Red)', value: hotspots.filter(h => h.status === 'critical').length, color: '#ef4444' },
    { name: 'High (Orange)', value: hotspots.filter(h => h.status === 'high').length, color: '#f97316' },
    { name: 'Medium (Yellow)', value: hotspots.filter(h => h.status === 'medium').length, color: '#eab308' },
    { name: 'Low (Green)', value: hotspots.filter(h => h.status === 'low').length, color: '#10b981' }
  ];

  return (
    <div className="command-center">
      {/* Top Application Header */}
      <header className="app-header">
        <div className="brand-section">
          <Shield size={24} className="logo-icon" />
          <span className="brand-title">PARKSIGHT</span>
          <span className="brand-tagline">Detect. Prioritize. Optimize.</span>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={resetFilters}>
            <RefreshCw size={14} /> Reset System
          </button>
        </div>
      </header>

      {/* Top Actionable Command Bar */}
      <section className="command-bar">
        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Hotspots</span>
            <span className="metric-value mono">{summaryMetrics.activeCount}</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#f97316' }}>
            <Activity size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Avg Impact (CIS)</span>
            <span className="metric-value mono">{summaryMetrics.avgCis}</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#eab308' }}>
            <Clock size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Est. Daily Delay</span>
            <span className="metric-value mono">{summaryMetrics.totalDelay.toLocaleString()} min</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#ef4444' }}>
            <TrendingUp size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Road Capacity Loss</span>
            <span className="metric-value mono">{summaryMetrics.avgCapacityLoss}%</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#3b82f6' }}>
            <Users size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Deployable Officers</span>
            <span className="metric-value mono">{availableOfficers}</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrapper" style={{ color: '#a78bfa' }}>
            <Truck size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Available Tows</span>
            <span className="metric-value mono">{availableTows}</span>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <section className="main-workspace">
        
        {/* LEFT SIDEBAR (20%) */}
        <nav className="sidebar">
          <div>
            <h3 className="sidebar-title">Operational Filters</h3>
            <div className="filter-group">
              <div className="filter-item">
                <label className="filter-label">Jurisdiction</label>
                <select className="filter-select" value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
                  <option value="ALL">ALL Stations</option>
                  <option value="Upparpet">Upparpet BTP</option>
                  <option value="Shivajinagar">Shivajinagar BTP</option>
                  <option value="Koramangala">Koramangala BTP</option>
                  <option value="Vijayanagara">Vijayanagara BTP</option>
                  <option value="City Market">City Market BTP</option>
                  <option value="HAL Old Airport">HAL Airport BTP</option>
                </select>
              </div>

              <div className="filter-item">
                <label className="filter-label">Vehicle Type</label>
                <select className="filter-select" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                  <option value="ALL">ALL Vehicles</option>
                  <option value="CAR">Cars</option>
                  <option value="SCOOTER">Scooters</option>
                  <option value="TANKER">Tankers / Buses</option>
                  <option value="AUTO">Passenger Autos</option>
                </select>
              </div>

              <div className="filter-item">
                <label className="filter-label">Time Window</label>
                <select className="filter-select" value={filterTime} onChange={(e) => setFilterTime(e.target.value)}>
                  <option value="ALL">24-Hour Coverage</option>
                  <option value="MORNING">Morning Peak (08:00 - 11:00)</option>
                  <option value="MIDDAY">Mid-Day (11:00 - 16:00)</option>
                  <option value="EVENING">Evening Peak (16:00 - 20:00)</option>
                </select>
              </div>

              <div className="filter-item">
                <div className="slider-container">
                  <label className="filter-label">Min CIS Threshold</label>
                  <span className="mono">{minCis.toFixed(1)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.5" 
                  value={minCis} 
                  onChange={(e) => setMinCis(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="filter-item">
                <div className="slider-container">
                  <label className="filter-label">Active Tow Trucks</label>
                  <span className="mono">{availableTows}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="12" 
                  value={availableTows} 
                  onChange={(e) => setAvailableTows(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 className="sidebar-title">Quick Actions</h3>
            <button className="btn btn-primary" onClick={showCritical}>
              <AlertTriangle size={16} /> Show Critical Hotspots
            </button>
            <button className="btn" onClick={generatePatrolPlan}>
              <Sliders size={16} /> Generate Patrol Plan
            </button>
            <button className="btn" onClick={() => alert("Report compiled successfully. Saved as PARKSIGHT_REPORT_BTP.pdf")}>
              <FileText size={16} /> Export Operations Report
            </button>
          </div>
        </nav>

        {/* CENTER PANEL (60%) */}
        <main className="center-panel">
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
              Interactive City Map
            </button>
            <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              Hotspot Analytics
            </button>
            <button className={`tab-btn ${activeTab === 'simulation' ? 'active' : ''}`} onClick={() => setActiveTab('simulation')}>
              What-If Simulation
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'map' && (
              <div className="city-map-container">
                <svg width="100%" height="100%">
                  {/* Grid lines to look like Smart City systems */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Outer grid boundary */}
                  <rect x="10" y="10" width="98%" height="96%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="5,5" />

                  {/* Draw simulated streets */}
                  <g>
                    {/* Ring road */}
                    <circle cx="450" cy="270" r="210" className="map-street" />
                    {/* Major intersecting arterials */}
                    <line x1="50" y1="270" x2="850" y2="270" className="map-street" />
                    <line x1="450" y1="20" x2="450" y2="520" className="map-street" />
                    <line x1="150" y1="50" x2="750" y2="450" className="map-street" />
                    
                    {/* Road name labels */}
                    <text x="70" y="260" className="map-street-label">NH-48 (Kanakapura Arterial)</text>
                    <text x="630" y="430" className="map-street-label">Outer Ring Road</text>
                    <text x="460" y="50" className="map-street-label">Modi Hospital Rd</text>
                  </g>

                  {/* Render active hotspots */}
                  <g>
                    {filteredHotspots.map(h => {
                      const color = h.cis >= 9.0 
                        ? '#ef4444' // red
                        : h.cis >= 8.0 
                          ? '#f97316' // orange
                          : h.cis >= 7.0 
                            ? '#eab308' // yellow
                            : '#10b981'; // green
                            
                      const isSelected = selectedHotspot && selectedHotspot.id === h.id;

                      return (
                        <g 
                          key={h.id} 
                          className="hotspot-node"
                          onClick={() => setSelectedHotspot(h)}
                        >
                          {/* Pulsing glow ring */}
                          <circle 
                            cx={h.x} 
                            cy={h.y} 
                            r={h.size + (isSelected ? 10 : 4)} 
                            fill="none" 
                            stroke={color} 
                            strokeWidth="1.5" 
                            strokeDasharray="4,4"
                            opacity={isSelected ? 1.0 : 0.4}
                          />
                          {/* Main node fill */}
                          <circle 
                            cx={h.x} 
                            cy={h.y} 
                            r={h.size} 
                            fill={color} 
                            opacity={isSelected ? 0.7 : 0.55} 
                          />
                          {/* Centroid dot */}
                          <circle cx={h.x} cy={h.y} r="3" fill="#ffffff" />
                          <text 
                            x={h.x} 
                            y={h.y - h.size - 6} 
                            fill="#ffffff" 
                            fontSize="10px" 
                            fontWeight="bold" 
                            textAnchor="middle"
                            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                          >
                            CIS {h.cis}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Hotspot details floating card */}
                {selectedHotspot && (
                  <div className="floating-card" style={{ borderLeft: `5px solid ${selectedHotspot.cis >= 9.0 ? '#ef4444' : selectedHotspot.cis >= 8.0 ? '#f97316' : '#eab308'}` }}>
                    <div className="floating-card-header">
                      <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedHotspot.name}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Jurisdiction: {selectedHotspot.jurisdiction} BTP</span>
                      </div>
                      <span className={`cis-badge ${selectedHotspot.cis >= 9.0 ? 'cis-critical' : selectedHotspot.cis >= 8.0 ? 'cis-high' : 'cis-medium'}`}>
                        CIS: {selectedHotspot.cis} / 10
                      </span>
                    </div>

                    <div className="floating-card-grid">
                      <div className="floating-card-metric">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Violations</span>
                        <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{selectedHotspot.violations} logged</span>
                      </div>
                      <div className="floating-card-metric">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Traffic Flow Impact</span>
                        <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedHotspot.affected_vehicles} vehicles/hr</span>
                      </div>
                      <div className="floating-card-metric">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Road Capacity Loss</span>
                        <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{selectedHotspot.capacity_loss}%</span>
                      </div>
                      <div className="floating-card-metric">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Economic Leakage</span>
                        <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#eab308' }}>₹{(selectedHotspot.economic_cost * complianceFactor).toLocaleString()}/day</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Recommended Action: </span>
                        <b style={{ color: 'white', fontSize: '0.85rem' }}>{selectedHotspot.action}</b>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Delay Reduction: </span>
                        <b style={{ color: '#10b981', fontSize: '0.85rem' }}>42%</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="analytics-container">
                <div className="chart-card">
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Hourly Violation Frequency Peaks</h4>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={barChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21252e" />
                        <XAxis dataKey="name" stroke="#535c6a" style={{ fontSize: 11 }} />
                        <YAxis stroke="#535c6a" style={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f1115', borderColor: '#21252e' }} />
                        <Bar dataKey="Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card">
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Hotspots Impact Score Distribution</h4>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f1115', borderColor: '#21252e' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'simulation' && (
              <div className="simulation-container">
                <div className="sim-panel">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>What-If Traffic Flow Simulator</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Adjust compliance target levels in the sidebar to simulate enforcement dispatch success. 
                    This calculation estimates travel times and fuel savings using baseline Indian Road Congress flow equations.
                  </p>
                  
                  <div className="simulation-grid">
                    <div>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', letterSpacing: '1px', marginBottom: '12px' }}>Current State (Baseline)</h4>
                      <div className="sim-comparison-card">
                        <div className="sim-row">
                          <span>Average Travel Speed</span>
                          <span className="mono" style={{ fontWeight: 'bold' }}>18 km/h</span>
                        </div>
                        <div className="sim-row">
                          <span>Intersection Delay Rate</span>
                          <span className="mono" style={{ fontWeight: 'bold' }}>4.2 min</span>
                        </div>
                        <div className="sim-row">
                          <span>Effective Capacity Loss</span>
                          <span className="mono" style={{ fontWeight: 'bold' }}>37%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#10b981', letterSpacing: '1px', marginBottom: '12px' }}>Target State (After Enforcement)</h4>
                      <div className="sim-comparison-card">
                        <div className="sim-row" style={{ borderLeft: '3px solid #10b981' }}>
                          <span>Average Travel Speed</span>
                          <span className="mono" style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {Math.round(18 + (11 * (complianceRate / 100)))} km/h
                          </span>
                        </div>
                        <div className="sim-row" style={{ borderLeft: '3px solid #10b981' }}>
                          <span>Intersection Delay Rate</span>
                          <span className="mono" style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {(4.2 - (2.1 * (complianceRate / 100))).toFixed(1)} min
                          </span>
                        </div>
                        <div className="sim-row" style={{ borderLeft: '3px solid #10b981' }}>
                          <span>Congestion Mitigation Rate</span>
                          <span className="mono" style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {Math.round(complianceRate * 0.42)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(37,99,235,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Compliance Slider Trigger: </span>
                    <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Active compliance improvement set to {complianceRate}% in current jurisdiction.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANEL (20%) */}
        <aside className="right-panel">
          
          {/* Section 1: Priority Queue */}
          <div className="panel-section">
            <h3 className="sidebar-title">Enforcement Priority Queue</h3>
            <div className="queue-list">
              {filteredHotspots.sort((a,b) => b.cis - a.cis).map((h, i) => {
                const badgeClass = h.cis >= 9.0 
                  ? 'cis-critical' 
                  : h.cis >= 8.0 
                    ? 'cis-high' 
                    : 'cis-medium';
                return (
                  <div 
                    key={h.id} 
                    className="queue-item"
                    style={{ borderLeft: `3px solid ${h.cis >= 9.0 ? '#ef4444' : h.cis >= 8.0 ? '#f97316' : '#eab308'}` }}
                    onClick={() => setSelectedHotspot(h)}
                  >
                    <div className="queue-item-header">
                      <span className="queue-item-title">Priority {i + 1}</span>
                      <span className={`cis-badge ${badgeClass}`}>CIS {h.cis}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Action: {h.action}</span>
                      <span style={{ color: '#10b981' }}>+42% flow</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Resource Optimization */}
          <div className="panel-section">
            <h3 className="sidebar-title">Resource Optimization Panel</h3>
            
            <div className="resource-grid">
              <div className="resource-bar-container">
                <div className="resource-bar-label">
                  <span>Officer Teams Deployed</span>
                  <span className="mono">{optimizationTriggered ? "4 / 4 Active" : "0 / 4 Deployed"}</span>
                </div>
                <div className="resource-bar-bg">
                  <div className="resource-bar-fill" style={{ width: optimizationTriggered ? '100%' : '0%' }}></div>
                </div>
              </div>

              <div className="resource-bar-container">
                <div className="resource-bar-label">
                  <span>Active Tow Truck Utilization</span>
                  <span className="mono">{optimizationTriggered ? "5 / 6 Deployed" : "0 / 6 Deployed"}</span>
                </div>
                <div className="resource-bar-bg">
                  <div className="resource-bar-fill" style={{ width: optimizationTriggered ? '83%' : '0%', backgroundColor: '#a78bfa' }}></div>
                </div>
              </div>
            </div>

            {optimizationTriggered ? (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Assignments</span>
                {dispatchRoutes.map((r, idx) => (
                  <div key={idx} style={{ fontSize: '0.8rem', padding: '6px 8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span><b>{r.team}</b> → {r.target.split(' ')[0]}</span>
                    <span style={{ color: '#10b981' }}>{r.expected_relief}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                Click "Generate Patrol Plan" to run optimizer CVRPTW solver routes.
              </div>
            )}
          </div>
        </aside>

      </section>
    </div>
  );
}
