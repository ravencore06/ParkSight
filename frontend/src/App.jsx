import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Users, 
  Truck, 
  Activity, 
  Sliders, 
  RotateCcw,
  ChevronRight,
  X,
  Navigation,
  AlertCircle,
  Search,
  Eye,
  Settings,
  Flame,
  Zap
} from 'lucide-react';
import { 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Spatiotemporal Hotspots in Bangalore mapping
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
    action: "Tow Immediately",
    expected_improvement: 42,
    lat: 12.9801,
    lng: 77.6046,
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
    action: "Deploy Officers",
    expected_improvement: 24,
    lat: 12.9775,
    lng: 77.5772,
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
    action: "Deploy Officers",
    expected_improvement: 18,
    lat: 12.9329,
    lng: 77.6143,
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
    action: "Deploy Officers",
    expected_improvement: 15,
    lat: 12.9863,
    lng: 77.5385,
    status: "active" // Blue
  },
  {
    id: 5,
    name: "HAL Airport Exit",
    jurisdiction: "HAL Old Airport",
    violations: 49,
    cis: 9.2,
    affected_vehicles: 1420,
    capacity_loss: 41,
    avg_delay: 4.8,
    economic_cost: 21500,
    co2_impact: 165,
    vehicle_mix: "CAR (55%), MAXI-CAB (20%), SCOOTER (25%)",
    action: "Tow Immediately",
    expected_improvement: 38,
    lat: 12.9592,
    lng: 77.6444,
    status: "critical" // Red
  },
  {
    id: 6,
    name: "KR Market Main Gate",
    jurisdiction: "City Market",
    violations: 33,
    cis: 8.1,
    affected_vehicles: 1150,
    capacity_loss: 28,
    avg_delay: 3.1,
    economic_cost: 13200,
    co2_impact: 102,
    vehicle_mix: "GOODS AUTO (40%), PRIVATE BUS (30%), SCOOTER (30%)",
    action: "Deploy Officers",
    expected_improvement: 22,
    lat: 12.9667,
    lng: 77.5750,
    status: "active" // Blue
  },
  {
    id: 7,
    name: "Modi Bridge Road Link",
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
    expected_improvement: 8,
    lat: 12.9984,
    lng: 77.5714,
    status: "neutral" // Grey
  }
];

// Helper to create custom DivIcon styles for Map Markers in Layer 1 & 3
const createDivIconMarker = (hotspot, isSelected) => {
  const statusClass = hotspot.status;
  const selectedClass = isSelected ? 'selected' : '';
  
  return L.divIcon({
    className: `custom-map-marker ${statusClass} ${selectedClass}`,
    html: `
      <div class="marker-ring"></div>
      <div class="marker-inner"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function App() {
  const [selectedHotspot, setSelectedHotspot] = useState(INITIAL_HOTSPOTS[0]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  // UI Layer, Theme and Search States
  const [activeLayer, setActiveLayer] = useState('operations'); // operations | congestion | enforcement
  const [activeTheme, setActiveTheme] = useState('light'); // light | executive | dark
  const [searchQuery, setSearchQuery] = useState('');
  const [aiFocusMode, setAiFocusMode] = useState(false);

  // Filter States
  const [filterStation, setFilterStation] = useState('ALL');
  const [filterVehicle, setFilterVehicle] = useState('ALL');
  const [minCis, setMinCis] = useState(0.0);
  
  // Simulation / Patrol optimization states
  const [complianceRate, setComplianceRate] = useState(0);
  const [optimizationTriggered, setOptimizationTriggered] = useState(false);
  const [dispatchRoutes, setDispatchRoutes] = useState([]);

  // Map DOM and Leaflet state references
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});
  const polylinesRef = useRef([]);
  const resourceMarkersRef = useRef([]);

  // Apply Theme attribute on document.body
  useEffect(() => {
    document.body.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  // Dynamic Map filter compilation
  const filteredHotspots = useMemo(() => {
    // If AI Focus mode is on, override normal filters to highlight top 5 highest-CIS hotspots
    if (aiFocusMode) {
      return [...INITIAL_HOTSPOTS]
        .sort((a, b) => b.cis - a.cis)
        .slice(0, 5);
    }

    return INITIAL_HOTSPOTS.filter(h => {
      // Station filter
      if (filterStation !== 'ALL' && h.jurisdiction !== filterStation) return false;
      
      // Vehicle type filter (maps dropdown categories strictly to raw dataset labels)
      if (filterVehicle !== 'ALL') {
        const mix = h.vehicle_mix.toLowerCase();
        if (filterVehicle === 'CAR' && !mix.includes('car') && !mix.includes('van') && !mix.includes('cab')) return false;
        if (filterVehicle === 'SCOOTER' && !mix.includes('scooter') && !mix.includes('cycle') && !mix.includes('moped')) return false;
        if (filterVehicle === 'TANKER' && !mix.includes('tanker') && !mix.includes('bus') && !mix.includes('lgv') && !mix.includes('hcv')) return false;
        if (filterVehicle === 'AUTO' && !mix.includes('auto')) return false;
      }

      // CIS slider
      if (h.cis < minCis) return false;

      // Search bar filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchName = h.name.toLowerCase().includes(query);
        const matchDiv = h.jurisdiction.toLowerCase().includes(query);
        if (!matchName && !matchDiv) return false;
      }
      return true;
    });
  }, [filterStation, filterVehicle, minCis, searchQuery, aiFocusMode]);

  const complianceFactor = (100 - complianceRate) / 100.0;

  // Header & sidebar summary aggregates
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
    const totalCost = filteredHotspots.reduce((sum, h) => sum + h.economic_cost, 0) * complianceFactor;
      
    return {
      activeCount,
      criticalCount,
      avgCis: parseFloat(avgCis.toFixed(1)),
      totalDelay: Math.round(totalDelay),
      avgCapacityLoss: Math.round(avgCapacityLoss),
      totalCost: Math.round(totalCost)
    };
  }, [filteredHotspots, complianceFactor]);

  // Leaflet Map Initialization
  useEffect(() => {
    let map;
    if (!mapInstance && mapContainerRef.current) {
      map = L.map(mapContainerRef.current, {
        zoomControl: false
      }).setView([12.9716, 77.5946], 13);
      
      // Reposition default zoom controls to bottom-left
      L.control.zoom({
        position: 'bottomleft'
      }).addTo(map);

      setMapInstance(map);
    }

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Sync Leaflet base tiles dynamically based on activeTheme (Light Positron vs Dark Matter)
  useEffect(() => {
    if (!mapInstance) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const tileUrl = activeTheme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance);
  }, [mapInstance, activeTheme]);

  // Handle map centering and pan transitions
  useEffect(() => {
    if (!mapInstance || !selectedHotspot) return;

    mapInstance.panTo([selectedHotspot.lat, selectedHotspot.lng], {
      animate: true,
      duration: 0.6
    });
  }, [mapInstance, selectedHotspot]);

  // Handle AI Focus bounds fitting
  useEffect(() => {
    if (!mapInstance) return;

    if (aiFocusMode) {
      const top5 = [...INITIAL_HOTSPOTS].sort((a, b) => b.cis - a.cis).slice(0, 5);
      const bounds = L.latLngBounds(top5.map(h => [h.lat, h.lng]));
      mapInstance.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
        animate: true,
        duration: 0.8
      });
      // Auto inspect highest-CIS hotspot
      setSelectedHotspot(top5[0]);
      setDrawerOpen(true);
    }
  }, [mapInstance, aiFocusMode]);

  // Render markers and layers (Layer 1: Ops, Layer 2: Congestion, Layer 3: Resources)
  useEffect(() => {
    if (!mapInstance) return;

    // 1. Clear standard incident markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // 2. Clear route polylines from Layer 3
    polylinesRef.current.forEach(line => line.remove());
    polylinesRef.current = [];

    // 3. Clear resources markers from Layer 3
    resourceMarkersRef.current.forEach(marker => marker.remove());
    resourceMarkersRef.current = [];

    // --- RENDER LAYER 1: OPERATIONS VIEW ---
    if (activeLayer === 'operations') {
      filteredHotspots.forEach(h => {
        const isSelected = selectedHotspot && selectedHotspot.id === h.id;
        const icon = createDivIconMarker(h, isSelected);

        const marker = L.marker([h.lat, h.lng], { icon })
          .addTo(mapInstance)
          .on('click', () => {
            setSelectedHotspot(h);
            setDrawerOpen(true);
          });

        markersRef.current[h.id] = marker;
      });
    }

    // --- RENDER LAYER 2: CONGESTION INTELLIGENCE VIEW ---
    if (activeLayer === 'congestion') {
      filteredHotspots.forEach(h => {
        // Red color gradient depending on capacity loss percentage
        let color = 'var(--success-green)'; // Healthy
        if (h.capacity_loss >= 40) color = 'var(--alert-red)'; // Critical
        else if (h.capacity_loss >= 30) color = 'var(--warning-orange)'; // High
        else if (h.capacity_loss >= 20) color = '#eab308'; // Moderate

        const isSelected = selectedHotspot && selectedHotspot.id === h.id;
        // Visual circles representing delay clusters
        const circle = L.circleMarker([h.lat, h.lng], {
          color: color,
          fillColor: color,
          fillOpacity: isSelected ? 0.65 : 0.4,
          weight: isSelected ? 3 : 1.5,
          radius: 12 + (h.capacity_loss / 3) // Sized based on capacity loss
        })
          .addTo(mapInstance)
          .on('click', () => {
            setSelectedHotspot(h);
            setDrawerOpen(true);
          });

        markersRef.current[h.id] = circle;
      });
    }

    // --- RENDER LAYER 3: ENFORCEMENT PLANNING VIEW ---
    if (activeLayer === 'enforcement') {
      // Render target hotspots
      filteredHotspots.forEach(h => {
        const isSelected = selectedHotspot && selectedHotspot.id === h.id;
        const icon = createDivIconMarker(h, isSelected);

        const marker = L.marker([h.lat, h.lng], { icon })
          .addTo(mapInstance)
          .on('click', () => {
            setSelectedHotspot(h);
            setDrawerOpen(true);
          });

        markersRef.current[h.id] = marker;
      });

      // Mock coordinates for Officers (Blue) and Tow trucks (Orange)
      const officers = [
        { id: 'O1', lat: 12.9820, lng: 77.6010, type: 'officer', label: 'P-12' },
        { id: 'O2', lat: 12.9750, lng: 77.5810, type: 'officer', label: 'P-05' }
      ];

      const tows = [
        { id: 'T1', lat: 12.9560, lng: 77.6410, type: 'tow', label: 'TOW-01' },
        { id: 'T2', lat: 12.9690, lng: 77.5710, type: 'tow', label: 'TOW-02' }
      ];

      // Draw Officer and Tow markers
      [...officers, ...tows].forEach(r => {
        const icon = L.divIcon({
          className: `custom-resource-marker ${r.type}`,
          html: `<span style="font-size: 8px; font-weight: 700;">${r.label}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([r.lat, r.lng], { icon }).addTo(mapInstance);
        resourceMarkersRef.current.push(marker);
      });

      // Draw optimized patrol route lines connecting officers to target junctions
      const routes = [
        { from: [12.9820, 77.6010], to: [12.9801, 77.6046], color: 'var(--accent-blue)' }, // Officer 1 to Safina Plaza
        { from: [12.9750, 77.5810], to: [12.9775, 77.5772], color: 'var(--accent-blue)' }, // Officer 2 to Sagar Theatre
        { from: [12.9560, 77.6410], to: [12.9592, 77.6444], color: 'var(--warning-orange)' } // Tow Truck 1 to HAL
      ];

      routes.forEach(route => {
        const line = L.polyline([route.from, route.to], {
          color: route.color,
          weight: 2,
          dashArray: '5, 5',
          opacity: 0.8
        }).addTo(mapInstance);
        polylinesRef.current.push(line);
      });
    }

  }, [mapInstance, filteredHotspots, activeLayer, selectedHotspot]);

  const resetAllFilters = () => {
    setMinCis(0.0);
    setFilterStation('ALL');
    setFilterVehicle('ALL');
    setComplianceRate(0);
    setSearchQuery('');
    setAiFocusMode(false);
    setOptimizationTriggered(false);
  };

  const handleSelectHotspot = (h) => {
    setSelectedHotspot(h);
    setDrawerOpen(true);
  };

  const triggerOptimization = () => {
    setOptimizationTriggered(true);
    const sorted = [...filteredHotspots].sort((a, b) => b.cis - a.cis);
    const routes = [];
    if (sorted.length > 0) {
      routes.push({ unit: "Patrol Alpha", target: sorted[0].name, action: sorted[0].action, code: "P-12" });
    }
    if (sorted.length > 1) {
      routes.push({ unit: "Patrol Beta", target: sorted[1].name, action: sorted[1].action, code: "P-05" });
    }
    if (sorted.length > 2) {
      routes.push({ unit: "Tow Unit 01", target: sorted[2].name, action: "Tow Vehicle", code: "TOW-01" });
    }
    setDispatchRoutes(routes);
  };

  // Recharts trend data
  const trendData = useMemo(() => [
    { name: '08:00', CIS: 7.2 },
    { name: '10:00', CIS: parseFloat((selectedHotspot ? selectedHotspot.cis : 9.6).toFixed(1)) },
    { name: '12:00', CIS: 8.1 },
    { name: '14:00', CIS: 7.4 },
    { name: '16:00', CIS: 8.7 },
    { name: '18:00', CIS: 9.2 },
    { name: '20:00', CIS: 7.9 }
  ], [selectedHotspot]);

  // Recharts vehicle mix breakdown
  const barChartData = useMemo(() => {
    if (!selectedHotspot) return [];
    const parts = selectedHotspot.vehicle_mix.split(', ');
    return parts.map(p => {
      const match = p.match(/([A-Z\s-]+)\s*\((\d+)%\)/);
      if (match) {
        return {
          name: match[1].trim(),
          percentage: parseInt(match[2])
        };
      }
      return { name: p, percentage: 0 };
    });
  }, [selectedHotspot]);

  return (
    <div className="app-container">
      {/* Redesigned Header: Brand, Search, Switchers, Profile */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            <svg width="26" height="26" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="24" cy="24" rx="20" ry="6" stroke="#90caf9" strokeWidth="3" fill="none" transform="rotate(-18, 24, 24)" />
              <path d="M18,10 h12 c4.5,0 8,3 8,8 s-3.5,8 -8,8 h-6 v12 h-6 V10 z M24,15 v6 h6 c1.5,0 2.5,-1 2.5,-3 s-1,-3 -2.5,-3 h-6 z" fill="#0072f5" />
            </svg>
          </div>
          <span className="brand-name">ParkSight</span>
          <span className="brand-divider">|</span>
          <span className="brand-slogan">DETECT. PRIORITIZE. OPTIMIZE.</span>
        </div>

        {/* Middle Global Search */}
        <div className="header-middle">
          <div className="search-box">
            <Search size={14} className="search-icon-svg" />
            <input 
              type="text" 
              placeholder="Search junctions or divisions..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right Switchers & Profiles */}
        <div className="header-right">
          {/* 3 Map Layers segmented switcher */}
          <div className="segmented-control">
            <button 
              className={`segmented-btn ${activeLayer === 'operations' ? 'active' : ''}`}
              onClick={() => setActiveLayer('operations')}
              title="Daily Traffic Operations View"
            >
              <Eye size={12} />
              <span>Operations</span>
            </button>
            <button 
              className={`segmented-btn ${activeLayer === 'congestion' ? 'active' : ''}`}
              onClick={() => setActiveLayer('congestion')}
              title="Congestion Traffic Analysis Heatmap"
            >
              <Flame size={12} />
              <span>Congestion</span>
            </button>
            <button 
              className={`segmented-btn ${activeLayer === 'enforcement' ? 'active' : ''}`}
              onClick={() => setActiveLayer('enforcement')}
              title="Enforcement Planning Resource Router"
            >
              <Navigation size={12} />
              <span>Enforcement</span>
            </button>
          </div>

          {/* 3 Themes Switcher */}
          <div className="segmented-control">
            <button 
              className={`segmented-btn ${activeTheme === 'light' ? 'active' : ''}`}
              onClick={() => setActiveTheme('light')}
              title="Operations Light Theme"
            >
              <span>Light</span>
            </button>
            <button 
              className={`segmented-btn ${activeTheme === 'executive' ? 'active' : ''}`}
              onClick={() => setActiveTheme('executive')}
              title="Executive Review Theme"
            >
              <span>Executive</span>
            </button>
            <button 
              className={`segmented-btn ${activeTheme === 'dark' ? 'active' : ''}`}
              onClick={() => setActiveTheme('dark')}
              title="Analytics Dark Theme"
            >
              <span>Dark</span>
            </button>
          </div>

          <div className="profile-avatar" title="Senior Traffic Commander">
            <span>ST</span>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="workspace">
        
        {/* Left Control Sidebar */}
        <aside className="left-sidebar">
          
          {/* Section 1: Filters */}
          <div className="sidebar-section">
            <div className="section-header">
              <span className="section-title">Control Filters</span>
              <button className="section-action" onClick={resetAllFilters}>Reset</button>
            </div>
            
            <div className="filters-grid">
              <div className="filter-control">
                <span className="filter-label">Jurisdiction</span>
                <select 
                  className="select-minimal" 
                  value={filterStation} 
                  onChange={(e) => setFilterStation(e.target.value)}
                  disabled={aiFocusMode}
                >
                  <option value="ALL">All Divisions</option>
                  <option value="Shivajinagar">Shivajinagar</option>
                  <option value="Upparpet">Upparpet</option>
                  <option value="Koramangala">Koramangala</option>
                  <option value="Vijayanagara">Vijayanagara</option>
                  <option value="City Market">City Market</option>
                  <option value="Malleshwaram">Malleshwaram</option>
                  <option value="HAL Old Airport">HAL Airport</option>
                </select>
              </div>

              <div className="filter-control">
                <span className="filter-label">Vehicle Mix</span>
                <select 
                  className="select-minimal" 
                  value={filterVehicle} 
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  disabled={aiFocusMode}
                >
                  <option value="ALL">All Categories</option>
                  <option value="CAR">Cars Only</option>
                  <option value="SCOOTER">Scooters Only</option>
                  <option value="TANKER">Buses / Tankers</option>
                  <option value="AUTO">Three-Wheelers</option>
                </select>
              </div>
            </div>

            <div className="slider-container">
              <div className="slider-header">
                <span>Minimum CIS Impact</span>
                <span className="mono">{minCis.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.5" 
                value={minCis} 
                onChange={(e) => setMinCis(parseFloat(e.target.value))}
                className="slider-input"
                disabled={aiFocusMode}
              />
            </div>

            {/* AI Focus Mode switch widget */}
            <div className="ai-focus-card">
              <div className="ai-focus-card-left">
                <Zap size={14} className="blue-text" style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <span className="ai-focus-title">Show Highest Impact Locations</span>
                  <p className="ai-focus-desc">Filter top 5 hotspots & show expected reduction</p>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={aiFocusMode}
                  onChange={(e) => setAiFocusMode(e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
            
            <button className="btn-primary-cta" onClick={triggerOptimization}>
              <Navigation size={14} />
              <span>Generate Patrol Plan</span>
            </button>
          </div>

          {/* Conditional Layout Section: Executive Theme Info Summary */}
          {activeTheme === 'executive' && (
            <div className="sidebar-section">
              <span className="section-title">Executive Summary Overview</span>
              <div className="exec-summary-row" style={{ marginTop: '10px' }}>
                <div className="exec-metric-card">
                  <span className="exec-metric-label">Total Loss</span>
                  <span className="exec-metric-value mono">₹{summaryMetrics.totalCost.toLocaleString()}</span>
                </div>
                <div className="exec-metric-card">
                  <span className="exec-metric-label">Patrol Units</span>
                  <span className="exec-metric-value mono">4/10</span>
                </div>
              </div>
              <div className="exec-chart-card">
                <span className="exec-metric-label" style={{ marginBottom: '8px', display: 'block' }}>Resource Allocation Status</span>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dispatched: <b>3 Active Routes</b></span>
                  <span style={{ color: 'var(--success-green)' }}>Efficient (85%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Priority Index Table */}
          <div className="sidebar-section">
            <div className="section-header">
              <span className="section-title">Priority Index</span>
              <span className="filter-label">{filteredHotspots.length} found</span>
            </div>

            <div className="priority-table-container">
              <table className="priority-table">
                <thead>
                  <tr>
                    <th>Junction</th>
                    <th>CIS</th>
                    <th>Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHotspots.length > 0 ? (
                    filteredHotspots.sort((a,b) => b.cis - a.cis).map((h, index) => {
                      const isSelected = selectedHotspot && selectedHotspot.id === h.id;
                      return (
                        <tr 
                          key={h.id} 
                          className={isSelected ? 'selected' : ''}
                          onClick={() => handleSelectHotspot(h)}
                        >
                          <td>
                            <div className="status-indicator">
                              <span className="mono" style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{index + 1}.</span>
                              <span className={`dot-badge ${h.status}`} />
                              <span>{h.name}</span>
                            </div>
                          </td>
                          <td className="mono font-semibold">{h.cis}</td>
                          <td className="mono" style={{ color: 'var(--accent-blue)' }}>+{h.expected_improvement}%</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0' }}>
                        No hotspots match filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Patrol Plan Checklist */}
          {optimizationTriggered && (
            <div className="sidebar-section">
              <div className="section-header">
                <span className="section-title">Patrol Deployment Plan</span>
                <span className="brand-badge">Optimal</span>
              </div>
              <div className="patrol-plan-container">
                {dispatchRoutes.map((r, idx) => (
                  <div key={idx} className="patrol-card">
                    <div className="patrol-card-header">
                      <span className="patrol-unit-name">
                        <Shield size={12} className="blue-text" style={{ color: 'var(--accent-blue)' }} />
                        <span>{r.unit}</span>
                      </span>
                      <span className="patrol-unit-badge">{r.code}</span>
                    </div>
                    <p className="patrol-assignment">
                      Deploying to <b>{r.target}</b> to resolve bottleneck congestion.
                    </p>
                    <span className="patrol-action-pill">{r.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </aside>

        {/* Right Map Viewport (occupies 70% width) */}
        <main className="map-pane">
          {/* Map canvas container */}
          <div ref={mapContainerRef} className="map-container-leaflet" />

          {/* AI Focus Floating banner */}
          {aiFocusMode && (
            <div className="ai-impact-overlay-banner">
              <span className="ai-overlay-badge">AI Focus Active</span>
              <span className="ai-overlay-text">
                Top 5 critical bottlenecks targeted. Expected delay reduction: <b>+38.5%</b>
              </span>
            </div>
          )}

          {/* Floating Map Legend */}
          <div className="map-legend-floating">
            {activeLayer === 'congestion' ? (
              <>
                <div className="legend-row">
                  <span className="legend-dot critical" />
                  <span>Critical Loss (≥ 40%)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot orange" />
                  <span>High Loss (30% - 39%)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot" style={{ backgroundColor: '#eab308' }} />
                  <span>Moderate Loss (20% - 29%)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot green" />
                  <span>Healthy Index (&lt; 20%)</span>
                </div>
              </>
            ) : (
              <>
                <div className="legend-row">
                  <span className="legend-dot critical" />
                  <span>Critical Alert (CIS ≥ 9.0)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot active" />
                  <span>Active Congestion (CIS 7.0 - 8.9)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot neutral" />
                  <span>Low Impact (CIS &lt; 7.0)</span>
                </div>
              </>
            )}
          </div>

          {/* Slide-over detail drawer */}
          <aside className={`slide-over-drawer ${drawerOpen && selectedHotspot ? 'open' : ''}`}>
            {selectedHotspot && (
              <>
                <div className="drawer-header">
                  <div className="drawer-header-left">
                    <h2 className="drawer-title">{selectedHotspot.name}</h2>
                    <span className="drawer-subtitle">{selectedHotspot.jurisdiction} Division</span>
                  </div>
                  <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="drawer-content">
                  
                  {/* Status Indicator Banner */}
                  <div className={`drawer-action-banner ${selectedHotspot.status === 'critical' ? 'critical' : ''}`}>
                    <span className="action-label-small">Recommended Dispatch Action</span>
                    <p className="action-text-detail">{selectedHotspot.action} immediately. Restores traffic throughput flow.</p>
                  </div>

                  {/* Section: Metrics Grid */}
                  <div>
                    <h3 className="drawer-section-title">Incident Parameters</h3>
                    <div className="detail-stats-grid">
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Congestion Index (CIS)</span>
                        <span className="detail-stat-value mono">{selectedHotspot.cis}</span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Capacity Loss</span>
                        <span className="detail-stat-value mono" style={{ color: selectedHotspot.status === 'critical' ? 'var(--alert-red)' : 'inherit' }}>
                          {Math.round(selectedHotspot.capacity_loss * complianceFactor)}%
                        </span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Affected Vehicles</span>
                        <span className="detail-stat-value mono">
                          {selectedHotspot.affected_vehicles}/hr
                        </span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Economic Loss Rate</span>
                        <span className="detail-stat-value mono">
                          ₹{Math.round(selectedHotspot.economic_cost * complianceFactor).toLocaleString()}/day
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Compliance Simulator */}
                  <div>
                    <h3 className="drawer-section-title">Enforcement Simulator</h3>
                    <div className="sim-drawer-card">
                      <div className="sim-slider-label">
                        <span>Compliance Target Rate</span>
                        <span><b>{complianceRate}%</b></span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5" 
                        value={complianceRate} 
                        onChange={(e) => setComplianceRate(parseInt(e.target.value))}
                        className="slider-input"
                      />
                      <div className="sim-comparison-grid">
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Delay Baseline</span>
                          <span className="sim-comp-val">{selectedHotspot.avg_delay} min</span>
                        </div>
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Delay (Simulated)</span>
                          <span className="sim-comp-val simulated-impact">
                            {(selectedHotspot.avg_delay * complianceFactor).toFixed(1)} min
                          </span>
                        </div>
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Expected Recovery</span>
                          <span className="sim-comp-val">0.0%</span>
                        </div>
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Recovery (Simulated)</span>
                          <span className="sim-comp-val simulated-impact">
                            {Math.round(selectedHotspot.expected_improvement * (complianceRate / 100))}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Vehicle Footprint Breakdown */}
                  <div>
                    <h3 className="drawer-section-title">Vehicle Mix Footprint</h3>
                    <div style={{ width: '100%', height: 120 }}>
                      <ResponsiveContainer>
                        <BarChart 
                          data={barChartData} 
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={true} vertical={false} />
                          <XAxis type="number" hide={true} />
                          <YAxis dataKey="name" type="category" style={{ fontSize: 9, fontWeight: 500 }} />
                          <Tooltip 
                            contentStyle={{ fontSize: 10, border: '1px solid var(--border-color)', borderRadius: 6 }} 
                            formatter={(value) => [`${value}%`, 'Percentage']}
                          />
                          <Bar dataKey="percentage" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} barSize={10} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Section: Hourly Violation Peak Trend */}
                  {activeTheme !== 'executive' && (
                    <div>
                      <h3 className="drawer-section-title">24h Bottleneck Index Trend</h3>
                      <div style={{ width: '100%', height: 140 }}>
                        <ResponsiveContainer>
                          <LineChart 
                            data={trendData}
                            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                            <XAxis dataKey="name" style={{ fontSize: 9, fontWeight: 500 }} />
                            <YAxis style={{ fontSize: 9 }} />
                            <Tooltip 
                              content={<CustomTooltip />}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="CIS" 
                              stroke="var(--accent-blue)" 
                              strokeWidth={2}
                              dot={{ r: 2 }} 
                              activeDot={{ r: 4 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}
          </aside>

        </main>

      </div>
    </div>
  );
}

// Custom tooltip renderer for Recharts Line Chart
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="recharts-minimal-tooltip">
        <p className="label">{label}</p>
        <p className="item">{`Bottleneck Index: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
}
