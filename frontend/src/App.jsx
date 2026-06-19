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
  Activity, 
  Sliders, 
  RefreshCw,
  BarChart2,
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

// Mock Hotspots data using 3-color status mappings: critical (red), active (blue), low (neutral)
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
    action: "Immediate Towing",
    x: 420,
    y: 190,
    size: 14,
    status: "critical" // Red
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
    action: "Deploy 2 Officers",
    x: 230,
    y: 280,
    size: 12,
    status: "active" // Blue
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
    action: "Routine Patrol",
    x: 600,
    y: 430,
    size: 10,
    status: "active" // Blue
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
    action: "Deploy 1 Officer",
    x: 180,
    y: 130,
    size: 10,
    status: "active" // Blue
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
    action: "Immediate Towing",
    x: 720,
    y: 320,
    size: 16,
    status: "critical" // Red
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
    action: "Deploy 2 Officers",
    x: 300,
    y: 370,
    size: 11,
    status: "active" // Blue
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
    action: "Routine Patrol",
    x: 350,
    y: 90,
    size: 8,
    status: "neutral" // Grey
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [selectedHotspot, setSelectedHotspot] = useState(INITIAL_HOTSPOTS[0]);
  
  // Toolbar Filter States
  const [filterStation, setFilterStation] = useState('ALL');
  const [filterVehicle, setFilterVehicle] = useState('ALL');
  const [minCis, setMinCis] = useState(0.0);
  
  // Resource Optimizer States
  const [complianceRate, setComplianceRate] = useState(0);
  const [optimizationTriggered, setOptimizationTriggered] = useState(false);
  const [dispatchRoutes, setDispatchRoutes] = useState([]);

  // Filter Data
  const filteredHotspots = useMemo(() => {
    return INITIAL_HOTSPOTS.filter(h => {
      if (filterStation !== 'ALL' && h.jurisdiction !== filterStation) return false;
      if (minCis > 0 && h.cis < minCis) return false;
      if (filterVehicle !== 'ALL' && !h.vehicle_mix.toLowerCase().includes(filterVehicle.toLowerCase())) return false;
      return true;
    });
  }, [filterStation, filterVehicle, minCis]);

  const complianceFactor = (100 - complianceRate) / 100.0;

  // Header Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activeCount = filteredHotspots.length;
    const criticalCount = filteredHotspots.filter(h => h.status === 'critical').length;
    const avgCis = activeCount > 0 
      ? (filteredHotspots.reduce((sum, h) => sum + h.cis, 0) / activeCount) 
      : 0;
    const totalDelay = filteredHotspots.reduce((sum, h) => sum + h.avg_delay * h.affected_vehicles, 0) * complianceFactor;
    const avgCapacityLoss = activeCount > 0 
      ? (filteredHotspots.reduce((sum, h) => sum + h.capacity_loss, 0) / activeCount) * complianceFactor
      : 0;
      
    return {
      activeCount,
      criticalCount,
      avgCis: parseFloat(avgCis.toFixed(1)),
      totalDelay: Math.round(totalDelay),
      avgCapacityLoss: Math.round(avgCapacityLoss)
    };
  }, [filteredHotspots, complianceFactor]);

  const resetAll = () => {
    setMinCis(0.0);
    setFilterStation('ALL');
    setFilterVehicle('ALL');
    setComplianceRate(0);
    setOptimizationTriggered(false);
  };

  const triggerOptimization = () => {
    setOptimizationTriggered(true);
    const sorted = [...filteredHotspots].sort((a, b) => b.cis - a.cis);
    const routes = [];
    if (sorted.length > 0) {
      routes.push({ unit: "Patrol Team Alpha", target: sorted[0].name, action: sorted[0].action });
    }
    if (sorted.length > 1) {
      routes.push({ unit: "Patrol Team Beta", target: sorted[1].name, action: sorted[1].action });
    }
    if (sorted.length > 2) {
      routes.push({ unit: "Tow Unit 01", target: sorted[0].name, action: "Tow Immediately" });
    }
    if (sorted.length > 3) {
      routes.push({ unit: "Tow Unit 02", target: sorted[1].name, action: "Clear Blockage" });
    }
    setDispatchRoutes(routes);
  };

  // Recharts Data mapping
  const trendData = [
    { name: '08:00', CIS: 7.2 },
    { name: '10:00', CIS: 9.6 },
    { name: '12:00', CIS: 8.1 },
    { name: '14:00', CIS: 7.4 },
    { name: '16:00', CIS: 8.7 },
    { name: '18:00', CIS: 9.2 },
    { name: '20:00', CIS: 7.9 }
  ];

  return (
    <div className="app-container">
      {/* 1. Brand Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-dot" />
          <span className="brand-name">PARKSIGHT</span>
          <span className="tagline font-mono">OPERATIONAL INTELLIGENCE</span>
        </div>

        {/* Actionable Compact Status Pills */}
        <div className="status-ticker">
          <div className="ticker-item">
            <span className="dot-indicator dot-red" />
            <span>Critical Hotspots:</span>
            <span className="ticker-value mono">{summaryMetrics.criticalCount}</span>
          </div>
          <div className="ticker-item">
            <span className="dot-indicator dot-blue" />
            <span>Avg CIS Impact:</span>
            <span className="ticker-value mono">{summaryMetrics.avgCis}</span>
          </div>
          <div className="ticker-item">
            <span className="dot-indicator dot-grey" />
            <span>Traffic Delay:</span>
            <span className="ticker-value mono">{summaryMetrics.totalDelay.toLocaleString()} min/h</span>
          </div>
        </div>
      </header>

      {/* 2. Split Workspace */}
      <div className="workspace">
        
        {/* LEFT COLUMN: Focus Area (Header, Toolbar, Content) */}
        <div className="main-content">
          
          <div className="content-header">
            {/* Vercel-style Tab Row */}
            <div className="tabs-row">
              <div className="tabs">
                <button className={`header-tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                  Map View
                </button>
                <button className={`header-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
                  Hotspot Analytics
                </button>
                <button className={`header-tab ${activeTab === 'simulation' ? 'active' : ''}`} onClick={() => setActiveTab('simulation')}>
                  Simulator Tab
                </button>
              </div>
            </div>

            {/* Horizontal Filter Toolbar */}
            <div className="toolbar-row">
              <div className="horizontal-toolbar">
                <div className="toolbar-item">
                  <span className="toolbar-label">Station</span>
                  <select className="select-minimal" value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
                    <option value="ALL">ALL Stations</option>
                    <option value="Shivajinagar">Shivajinagar</option>
                    <option value="Upparpet">Upparpet</option>
                    <option value="Koramangala">Koramangala</option>
                    <option value="Vijayanagara">Vijayanagara</option>
                    <option value="City Market">City Market</option>
                    <option value="HAL Old Airport">HAL Airport</option>
                  </select>
                </div>

                <div className="toolbar-item">
                  <span className="toolbar-label">Vehicle</span>
                  <select className="select-minimal" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                    <option value="ALL">ALL Vehicles</option>
                    <option value="CAR">Cars</option>
                    <option value="SCOOTER">Scooters</option>
                    <option value="TANKER">Tankers / Buses</option>
                    <option value="AUTO">Autos</option>
                  </select>
                </div>

                <div className="toolbar-item">
                  <span className="toolbar-label">Min CIS: <span className="mono text-white font-medium">{minCis.toFixed(1)}</span></span>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.5" 
                    value={minCis} 
                    onChange={(e) => setMinCis(parseFloat(e.target.value))}
                    className="slider-minimal"
                  />
                </div>
              </div>

              <div className="toolbar-actions">
                <button className="btn-minimal btn-primary" onClick={triggerOptimization}>
                  Generate Patrol Plan
                </button>
                <button className="btn-minimal" onClick={resetAll}>
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Core Tab Canvas */}
          <div className="tab-content">
            {activeTab === 'map' && (
              <div className="map-view">
                <div className="map-canvas">
                  <svg width="100%" height="100%" viewBox="0 0 900 550" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.5" fill="#1c1c1e" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-dots)" />

                    {/* Road Network Lines */}
                    <g>
                      <line x1="50" y1="270" x2="850" y2="270" className="street-line street-line-major" />
                      <line x1="450" y1="20" x2="450" y2="520" className="street-line street-line-major" />
                      <line x1="150" y1="50" x2="750" y2="450" className="street-line" />
                      <circle cx="450" cy="270" r="180" fill="none" stroke="#121214" strokeWidth="2.5" />

                      <text x="460" y="45" className="street-text">Modi Hospital Rd</text>
                      <text x="70" y="260" className="street-text">NH-48 Link</text>
                      <text x="630" y="415" className="street-text">Outer Ring Road</text>
                    </g>

                    {/* Node Representations */}
                    <g>
                      {filteredHotspots.map(h => {
                        const isCritical = h.status === 'critical';
                        const isActive = h.status === 'active';
                        const strokeColor = isCritical ? 'var(--alert-red)' : (isActive ? 'var(--primary-blue)' : 'var(--text-muted)');
                        const fillColor = isCritical ? 'rgba(255, 0, 85, 0.12)' : (isActive ? 'rgba(0, 112, 243, 0.1)' : 'rgba(83, 92, 106, 0.05)');
                        const isSelected = selectedHotspot && selectedHotspot.id === h.id;

                        return (
                          <g 
                            key={h.id} 
                            className="node-group"
                            onClick={() => setSelectedHotspot(h)}
                          >
                            {/* Inner Circle Fill */}
                            <circle 
                              cx={h.x} 
                              cy={h.y} 
                              r={isSelected ? h.size + 4 : h.size} 
                              className="node-center"
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={isSelected ? "1.5" : "1"}
                            />
                            {/* Glow Outer ring */}
                            <circle 
                              cx={h.x} 
                              cy={h.y} 
                              r={isSelected ? h.size + 10 : h.size + 4} 
                              className="node-ring"
                              stroke={strokeColor}
                              fill="none"
                              opacity={isSelected ? 1.0 : 0.4}
                            />
                            {/* Centroid Dot */}
                            <circle cx={h.x} cy={h.y} r="2" fill="#ffffff" />
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="analytics-grid">
                <div className="analytics-row">
                  <div className="analytics-card">
                    <span className="analytics-title">Operational Violation Trends</span>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1e" />
                          <XAxis dataKey="name" stroke="#444444" style={{ fontSize: 10 }} />
                          <YAxis stroke="#444444" style={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#000000', borderColor: '#1c1c1e', color: '#ffffff' }} />
                          <Line type="monotone" dataKey="CIS" stroke="var(--primary-blue)" strokeWidth={1.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="analytics-card">
                    <span className="analytics-title">Top Junction Capacity Loss</span>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart data={filteredHotspots.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1e" />
                          <XAxis dataKey="name" stroke="#444444" style={{ fontSize: 8 }} />
                          <YAxis stroke="#444444" style={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#000000', borderColor: '#1c1c1e', color: '#ffffff' }} />
                          <Bar dataKey="capacity_loss" fill="var(--alert-red)" radius={[3, 3, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'simulation' && (
              <div className="sim-grid">
                <div className="sim-controller">
                  <div className="sim-controller-header">
                    <span className="analytics-title">Simulation Parameters</span>
                    <span className="mono font-semibold text-white">{complianceRate}% Enforcement Compliance</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5" 
                    value={complianceRate} 
                    onChange={(e) => setComplianceRate(parseInt(e.target.value))}
                    className="slider-minimal sim-slider"
                  />
                  <p className="sim-controller-desc">
                    Adjust the compliance rate slider to predict traffic speeds, capacity recovery, and reduction in economic impact.
                  </p>
                </div>

                <div className="sim-columns">
                  <div className="sim-column-card">
                    <span className="analytics-title">Current Baseline</span>
                    <div className="sim-metric-row">
                      <span>Average Traffic Speed</span>
                      <span className="mono">18 km/h</span>
                    </div>
                    <div className="sim-metric-row">
                      <span>Intersection Delay</span>
                      <span className="mono">4.2 min</span>
                    </div>
                    <div className="sim-metric-row">
                      <span>Effective Capacity Loss</span>
                      <span className="mono">37%</span>
                    </div>
                  </div>

                  <div className="sim-column-card" style={{ borderColor: 'rgba(0,112,243,0.3)' }}>
                    <span className="analytics-title" style={{ color: 'var(--primary-blue)' }}>After Enforcement (Simulated)</span>
                    <div className="sim-metric-row">
                      <span>Average Traffic Speed</span>
                      <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: 500 }}>
                        {Math.round(18 + (11 * (complianceRate / 100)))} km/h
                      </span>
                    </div>
                    <div className="sim-metric-row">
                      <span>Intersection Delay</span>
                      <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: 500 }}>
                        {(4.2 - (2.1 * (complianceRate / 100))).toFixed(1)} min
                      </span>
                    </div>
                    <div className="sim-metric-row">
                      <span>Congestion Reduction</span>
                      <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: 500 }}>
                        {Math.round(complianceRate * 0.42)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Hotspot Details, Queue, Patrol plan) */}
        <aside className="right-sidebar">
          {/* Selected Hotspot Section */}
          <div className="sidebar-section border-bottom">
            <h3 className="section-label">Inspection Panel</h3>
            {selectedHotspot ? (
              <div className="selected-hotspot-details">
                <div className="hotspot-header">
                  <span className="hotspot-name">{selectedHotspot.name}</span>
                  <span className={`pill ${selectedHotspot.status === 'critical' ? 'pill-critical' : (selectedHotspot.status === 'active' ? 'pill-active' : 'pill-neutral')}`}>
                    CIS {selectedHotspot.cis}
                  </span>
                </div>
                <div className="hotspot-location font-mono">{selectedHotspot.jurisdiction} Division</div>
                
                <div className="stats-grid">
                  <div className="stat-box">
                    <span className="stat-label">Violations</span>
                    <span className="stat-val mono">{selectedHotspot.violations}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Impact Flow</span>
                    <span className="stat-val mono">{selectedHotspot.affected_vehicles}/h</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Cap. Loss</span>
                    <span className="stat-val mono alert-text">{selectedHotspot.capacity_loss}%</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Econ. Cost</span>
                    <span className="stat-val mono">₹{(selectedHotspot.economic_cost * complianceFactor).toLocaleString()}</span>
                  </div>
                </div>

                <div className="action-banner">
                  <div className="action-title">RECOMMENDED ACTION</div>
                  <div className="action-desc">{selectedHotspot.action}</div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                Select a hotspot node on the map to inspect operational details.
              </div>
            )}
          </div>

          {/* Priority Queue Section */}
          <div className="sidebar-section border-bottom">
            <h3 className="section-label font-mono">Priority Hotspots</h3>
            <div className="priority-list">
              {filteredHotspots.length > 0 ? (
                filteredHotspots.sort((a,b) => b.cis - a.cis).map((h) => {
                  const isSelected = selectedHotspot && selectedHotspot.id === h.id;
                  return (
                    <div 
                      key={h.id} 
                      className={`priority-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedHotspot(h)}
                    >
                      <span className="priority-name">{h.name}</span>
                      <span className={`pill-dot ${h.status === 'critical' ? 'dot-red' : (h.status === 'active' ? 'dot-blue' : 'dot-grey')}`} />
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">No hotspots matching active filters.</div>
              )}
            </div>
          </div>

          {/* Patrol Plan Section */}
          <div className="sidebar-section">
            <h3 className="section-label font-mono">Patrol Plan</h3>
            <div className="patrol-list">
              {optimizationTriggered ? (
                dispatchRoutes.map((r, idx) => (
                  <div key={idx} className="patrol-item">
                    <div className="patrol-unit font-mono">
                      <ChevronRight size={12} className="blue-text" />
                      <span>{r.unit}</span>
                    </div>
                    <div className="patrol-assignment">
                      Deploy to <b>{r.target.split(' ')[0]}</b>: <span>{r.action}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No active patrol plan. Click "Generate Patrol Plan" to trigger.
                </div>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
