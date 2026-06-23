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
import hotspotsData from './hotspots.json';

// Helper to calculate distance between two coordinates in km (Haversine formula)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Mock road data for the premium Traffic Layer (base without hardcoded hotspots)
const TRAFFIC_ROADS_BASE = [
  {
    id: "R1",
    name: "MG Road Corridor",
    path: [[12.9785, 77.6010], [12.9801, 77.6046], [12.9805, 77.6095]],
    speed: 18,
    free_flow_speed: 50,
    congestion: "orange",
    affected_vehicles: 1240,
    estimated_delay: 4.2,
    parking_suspected: true
  },
  {
    id: "R2",
    name: "K.G. Road (Upparpet)",
    path: [[12.9730, 77.5750], [12.9775, 77.5772], [12.9790, 77.5780]],
    speed: 12,
    free_flow_speed: 45,
    congestion: "red",
    affected_vehicles: 980,
    estimated_delay: 5.6,
    parking_suspected: true
  },
  {
    id: "R3",
    name: "Koramangala 80ft Road",
    path: [[12.9300, 77.6140], [12.9329, 77.6143], [12.9370, 77.6150]],
    speed: 32,
    free_flow_speed: 45,
    congestion: "yellow",
    affected_vehicles: 850,
    estimated_delay: 2.1,
    parking_suspected: false
  },
  {
    id: "R4",
    name: "HAL Airport Road",
    path: [[12.9570, 77.6400], [12.9592, 77.6444], [12.9610, 77.6480]],
    speed: 7,
    free_flow_speed: 60,
    congestion: "dark-red",
    affected_vehicles: 1420,
    estimated_delay: 8.5,
    parking_suspected: true
  },
  {
    id: "R5",
    name: "Malleshwaram Link Road",
    path: [[12.9960, 77.5710], [12.9984, 77.5714], [13.0010, 77.5720]],
    speed: 48,
    free_flow_speed: 50,
    congestion: "green",
    affected_vehicles: 510,
    estimated_delay: 0.5,
    parking_suspected: false
  },
  {
    id: "R6",
    name: "Modi Hospital Road",
    path: [[12.9840, 77.5380], [12.9863, 77.5385], [12.9890, 77.5390]],
    speed: 24,
    free_flow_speed: 45,
    congestion: "orange",
    affected_vehicles: 720,
    estimated_delay: 3.2,
    parking_suspected: true
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
  const [hotspotsList, setHotspotsList] = useState(hotspotsData);
  const [selectedHotspot, setSelectedHotspot] = useState(hotspotsData[0]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Shadow INITIAL_HOTSPOTS so all hooks and rendering use the fetched hotspots list
  const INITIAL_HOTSPOTS = hotspotsList;

  // Shadow TRAFFIC_ROADS dynamically linking to nearest active hotspots using physical coordinates
  const TRAFFIC_ROADS = useMemo(() => {
    return TRAFFIC_ROADS_BASE.map(road => {
      // Find all hotspots within 1.0 km of any point in the road's path
      const nearby = INITIAL_HOTSPOTS.filter(hotspot => {
        return road.path.some(pt => getDistance(pt[0], pt[1], hotspot.lat, hotspot.lng) < 1.0);
      }).map(h => h.name);
      
      return {
        ...road,
        nearby_hotspots: nearby
      };
    });
  }, [INITIAL_HOTSPOTS]);

  // Fetch hotspots from the backend API server
  useEffect(() => {
    fetch('http://localhost:5000/api/hotspots')
      .then(res => {
        if (!res.ok) {
          throw new Error('API server returned error status');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setHotspotsList(data);
          setSelectedHotspot(data[0]);
        }
      })
      .catch(err => {
        console.warn("Failed to fetch hotspots from backend API, using fallback data:", err);
      });
  }, []);

  // Dynamic divisions from the real dataset
  const uniqueStations = useMemo(() => {
    const stations = new Set(INITIAL_HOTSPOTS.map(h => h.jurisdiction));
    return ["ALL", ...Array.from(stations).sort()];
  }, []);

  // Dynamic Traffic Dashboard Stats calculated from TRAFFIC_ROADS
  const avgNetworkSpeed = useMemo(() => {
    return (TRAFFIC_ROADS.reduce((sum, r) => sum + r.speed, 0) / TRAFFIC_ROADS.length).toFixed(1);
  }, []);

  const criticalCorridorName = useMemo(() => {
    const sorted = [...TRAFFIC_ROADS].sort((a, b) => a.speed - b.speed);
    return sorted[0] ? sorted[0].name : "N/A";
  }, []);

  const highDelayCorridorText = useMemo(() => {
    const sorted = [...TRAFFIC_ROADS].sort((a, b) => b.estimated_delay - a.estimated_delay);
    return sorted[0] ? `${sorted[0].name} (+${sorted[0].estimated_delay}m)` : "N/A";
  }, []);
  
  // UI Layer, Theme and Search States
  const [activeLayer, setActiveLayer] = useState('operations'); // operations | congestion | enforcement
  const [activeTheme, setActiveTheme] = useState('light'); // light | executive | dark
  const [searchQuery, setSearchQuery] = useState('');
  const [aiFocusMode, setAiFocusMode] = useState(false);
  const [trafficOverlayActive, setTrafficOverlayActive] = useState(false);

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
  const trafficPolylinesRef = useRef([]);
  const bottleneckMarkersRef = useRef([]);
  const delayZonesRef = useRef([]);

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

  // Automatically sync/update selected hotspot details inside side panel when filters change
  useEffect(() => {
    if (filteredHotspots.length > 0) {
      // Check if current selectedHotspot is still inside the newly filtered hotspots
      const isStillFiltered = selectedHotspot && filteredHotspots.some(h => h.id === selectedHotspot.id);
      if (!isStillFiltered || selectedRoad) {
        // Switch side panel to display the top priority hotspot for the new filter/jurisdiction
        setSelectedHotspot(filteredHotspots[0]);
        setSelectedRoad(null);
        setDrawerOpen(true);
      }
    } else {
      setSelectedHotspot(null);
      setSelectedRoad(null);
      setDrawerOpen(false);
    }
  }, [filteredHotspots]);

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

    // 4. Clear traffic overlay elements
    trafficPolylinesRef.current.forEach(line => line.remove());
    trafficPolylinesRef.current = [];
    bottleneckMarkersRef.current.forEach(m => m.remove());
    bottleneckMarkersRef.current = [];
    delayZonesRef.current.forEach(z => z.remove());
    delayZonesRef.current = [];

    // --- RENDER LAYER 1: OPERATIONS VIEW ---
    if (activeLayer === 'operations') {
      filteredHotspots.forEach(h => {
        const isSelected = selectedHotspot && selectedHotspot.id === h.id;
        const icon = createDivIconMarker(h, isSelected);

        const marker = L.marker([h.lat, h.lng], { icon })
          .addTo(mapInstance)
          .on('click', () => {
            handleSelectHotspot(h);
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
            handleSelectHotspot(h);
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
            handleSelectHotspot(h);
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

      // Draw optimized patrol route lines connecting officers to target junctions dynamically
      // Find top hotspots sorted by CIS dynamically to avoid hardcoded names
      const sortedByCis = [...INITIAL_HOTSPOTS].sort((a, b) => b.cis - a.cis);
      const targetHotspots = sortedByCis.slice(0, 3);

      const routes = [];
      if (targetHotspots.length > 0) {
        routes.push({ from: [12.9820, 77.6010], to: [targetHotspots[0].lat, targetHotspots[0].lng], color: 'var(--accent-blue)' }); // Officer 1 to Top 1 Hotspot
      }
      if (targetHotspots.length > 1) {
        routes.push({ from: [12.9750, 77.5810], to: [targetHotspots[1].lat, targetHotspots[1].lng], color: 'var(--accent-blue)' }); // Officer 2 to Top 2 Hotspot
      }
      if (targetHotspots.length > 2) {
        routes.push({ from: [12.9560, 77.6410], to: [targetHotspots[2].lat, targetHotspots[2].lng], color: 'var(--warning-orange)' }); // Tow Truck 1 to Top 3 Hotspot
      }

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

    // --- RENDER TRAFFIC OVERLAY (Optional Overlay) ---
    if (trafficOverlayActive) {
      TRAFFIC_ROADS.forEach(road => {
        const isSelected = selectedRoad && selectedRoad.id === road.id;
        
        // Define color based on congestion density
        let color = 'var(--success-green)';
        if (road.congestion === 'yellow') color = '#eab308';
        else if (road.congestion === 'orange') color = 'var(--warning-orange)';
        else if (road.congestion === 'red') color = 'var(--alert-red)';
        else if (road.congestion === 'dark-red') color = '#991b1b';

        // 1. Draw Flow Line
        const polyline = L.polyline(road.path, {
          color: color,
          weight: isSelected ? 8 : 4.5,
          opacity: isSelected ? 0.95 : 0.75,
          className: `traffic-flow-line ${road.congestion} ${isSelected ? 'selected' : ''}`
        })
        .addTo(mapInstance)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          handleSelectRoad(road);
        });

        trafficPolylinesRef.current.push(polyline);

        // 2. Draw Bottleneck Indicator (Pulsing marker)
        if (road.parking_suspected && (road.congestion === 'red' || road.congestion === 'dark-red' || road.congestion === 'orange')) {
          const midPoint = road.path[Math.floor(road.path.length / 2)];
          
          const icon = L.divIcon({
            className: `bottleneck-marker ${isSelected ? 'selected' : ''}`,
            html: `
              <div class="bottleneck-pulse"></div>
              <div class="bottleneck-icon-inner">⚠️</div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const marker = L.marker(midPoint, { icon })
            .addTo(mapInstance)
            .on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              handleSelectRoad(road);
            });

          bottleneckMarkersRef.current.push(marker);
        }

        // 3. Draw Delay Zone (Soft glow circle overlay)
        if (road.congestion === 'red' || road.congestion === 'dark-red') {
          const midPoint = road.path[Math.floor(road.path.length / 2)];
          const circle = L.circle(midPoint, {
            radius: 200, // meters
            color: color,
            fillColor: color,
            fillOpacity: isSelected ? 0.12 : 0.05,
            weight: 1,
            dashArray: '3, 6',
            className: 'traffic-delay-zone'
          })
          .addTo(mapInstance);
          
          delayZonesRef.current.push(circle);
        }
      });
    }

  }, [mapInstance, filteredHotspots, activeLayer, selectedHotspot, trafficOverlayActive, selectedRoad]);

  const resetAllFilters = () => {
    setMinCis(0.0);
    setFilterStation('ALL');
    setFilterVehicle('ALL');
    setComplianceRate(0);
    setSearchQuery('');
    setAiFocusMode(false);
    setOptimizationTriggered(false);
    setTrafficOverlayActive(false);
    setSelectedRoad(null);
  };

  const handleSelectHotspot = (h) => {
    setSelectedHotspot(h);
    setSelectedRoad(null);
    setDrawerOpen(true);
  };

  const handleSelectRoad = (r) => {
    setSelectedRoad(r);
    setSelectedHotspot(null);
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
  const trendData = useMemo(() => {
    return selectedHotspot ? selectedHotspot.trend_data : [];
  }, [selectedHotspot]);

  // Recharts vehicle mix breakdown
  const barChartData = useMemo(() => {
    return selectedHotspot ? selectedHotspot.vehicle_mix_data : [];
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
                  {uniqueStations.map(station => (
                    <option key={station} value={station}>
                      {station === "ALL" ? "All Divisions" : station}
                    </option>
                  ))}
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

          {/* Traffic Dashboard floating chips above the map */}
          <div className="traffic-chips-container">
            <div className="traffic-chip">
              <span className="traffic-chip-label">Avg Network Speed</span>
              <span className="traffic-chip-value mono">{avgNetworkSpeed} km/h</span>
            </div>
            <div className="traffic-chip">
              <span className="traffic-chip-label">Critical Corridor</span>
              <span className="traffic-chip-value red-text">{criticalCorridorName}</span>
            </div>
            <div className="traffic-chip">
              <span className="traffic-chip-label">High Delay Zone</span>
              <span className="traffic-chip-value orange-text">{highDelayCorridorText}</span>
            </div>
          </div>

          {/* Floating Traffic Overlay Control Toggle */}
          <div className="traffic-toggle-card">
            <div className="traffic-toggle-label">
              <Activity size={12} className={trafficOverlayActive ? "pulse-blue" : ""} />
              <span>Traffic Flow Layer</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={trafficOverlayActive}
                onChange={(e) => {
                  setTrafficOverlayActive(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedRoad(null);
                  }
                }}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          {/* AI Focus Floating banner */}
          {aiFocusMode && (
            <div className="ai-impact-overlay-banner">
              <span className="ai-overlay-badge">AI Focus Active</span>
              <span className="ai-overlay-text">
                Top 5 critical bottlenecks targeted. Expected delay reduction: <b>+{ (filteredHotspots.slice(0, 5).reduce((sum, h) => sum + h.expected_improvement, 0) / Math.max(1, filteredHotspots.slice(0, 5).length)).toFixed(1) }%</b>
              </span>
            </div>
          )}

          {/* Floating Map Legend */}
          <div className="map-legend-floating">
            {trafficOverlayActive && (
              <div className="legend-section" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                <span className="legend-section-title" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Traffic Flow</span>
                <div className="legend-row">
                  <span className="legend-dot" style={{ backgroundColor: '#991b1b' }} />
                  <span>Critical (&lt; 12 km/h)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot critical" />
                  <span>Severe (12-20 km/h)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot orange" />
                  <span>Heavy (20-30 km/h)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot" style={{ backgroundColor: '#eab308' }} />
                  <span>Moderate (30-40 km/h)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot green" />
                  <span>Free Flow (&gt; 40 km/h)</span>
                </div>
              </div>
            )}
            
            <span className="legend-section-title" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              {activeLayer === 'congestion' ? 'Congestion Capacity' : 'Hotspot Urgency'}
            </span>
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
          <aside className={`slide-over-drawer ${(drawerOpen && (selectedHotspot || selectedRoad)) ? 'open' : ''}`}>
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

                  {/* Explainability Engine: Why this recommendation? */}
                  <div className="explainability-card" style={{ marginTop: '16px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                    <span className="drawer-section-title" style={{ marginTop: 0, marginBottom: '8px', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Why this recommendation?</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Violations:</span>
                        <div className="mono font-semibold">{selectedHotspot.violations.toLocaleString()}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Peak Hour:</span>
                        <div className="mono font-semibold">{selectedHotspot.peak_hour}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Vehicle Mix:</span>
                        <div style={{ fontWeight: 500 }}>{selectedHotspot.vehicle_mix_data.slice(0, 2).map(v => `${v.name} (${Math.round(v.percentage)}%)`).join(', ')}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Normalized CIS:</span>
                        <div className="mono font-semibold" style={{ color: 'var(--accent-blue)' }}>{selectedHotspot.cis} / 10</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: '1.4', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Reason:</span>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {selectedHotspot.cis >= 8.0 
                          ? "Critical bottleneck showing extreme peak-hour congestion and heavy vehicle footprint. Immediate towing enforcement required."
                          : selectedHotspot.cis >= 5.0 
                          ? "High violation density and sustained peak-hour concentration. Scheduled officer deployment recommended to clear transit capacity."
                          : "Routine patrol. Minor parking friction with low baseline delay impact."
                        }
                      </span>
                    </div>
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
                      <div style={{ fontSize: '11px', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Current Situation:</div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          Active obstruction causing an average delay of <b>{selectedHotspot.avg_delay} min</b> per vehicle, affecting <b>{selectedHotspot.affected_vehicles} vehicles/hr</b> and incurring a daily economic loss rate of <b>₹{selectedHotspot.economic_cost.toLocaleString()}</b>.
                        </div>
                      </div>

                      <div className="sim-slider-label" style={{ marginTop: '12px' }}>
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Expected Max Improvement</span>
                          <span className="sim-comp-val" style={{ color: 'var(--accent-blue)' }}>+{selectedHotspot.expected_improvement}%</span>
                        </div>
                        <div className="sim-comparison-box">
                          <span className="sim-comp-title">Simulated Realized Recovery</span>
                          <span className="sim-comp-val simulated-impact" style={{ color: 'var(--success-green)' }}>
                            +{Math.round(selectedHotspot.expected_improvement * (complianceRate / 100))}%
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '6px', lineHeight: '1.3' }}>
                        <b>Estimation Model Reasoning:</b> Expected improvement is dynamically modeled as min(50%, Normalized CIS &times; 5) scaled by target enforcement compliance.
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

            {selectedRoad && (
              <>
                <div className="drawer-header">
                  <div className="drawer-header-left">
                    <h2 className="drawer-title">{selectedRoad.name}</h2>
                    <span className="drawer-subtitle">Traffic Flow Corridor</span>
                  </div>
                  <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="drawer-content">
                  {/* ParkSight Intelligence Overlap alert */}
                  {selectedRoad.parking_suspected ? (
                    <div className="drawer-action-banner critical" style={{ borderLeftWidth: '3px' }}>
                      <span className="action-label-small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={11} />
                        Parking-Induced Congestion Suspected
                      </span>
                      <p className="action-text-detail">
                        Severe vehicle bottlenecking correlates directly with active nearby illegal parking hotspot ({selectedRoad.nearby_hotspots.join(', ')}). Enforcement recommended to restore road throughput capacity.
                      </p>
                    </div>
                  ) : (
                    <div className="drawer-action-banner" style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--success-green)', backgroundColor: 'var(--success-green-light)' }}>
                      <span className="action-label-small" style={{ color: 'var(--success-green)' }}>Standard Flow</span>
                      <p className="action-text-detail" style={{ color: 'var(--text-primary)' }}>
                        Traffic is moving within normal spatiotemporal parameters. No major parking obstacles detected.
                      </p>
                    </div>
                  )}

                  {/* Road Parameters Grid */}
                  <div>
                    <h3 className="drawer-section-title">Corridor Parameters</h3>
                    <div className="detail-stats-grid">
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Average Speed</span>
                        <span className="detail-stat-value mono">{selectedRoad.speed} km/h</span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Congestion Level</span>
                        <span className={`detail-stat-value capitalize font-semibold ${selectedRoad.congestion === 'red' || selectedRoad.congestion === 'dark-red' ? 'red-text' : selectedRoad.congestion === 'orange' ? 'orange-text' : 'green-text'}`}>
                          {selectedRoad.congestion === 'dark-red' ? 'Critical' : selectedRoad.congestion === 'red' ? 'Severe' : selectedRoad.congestion === 'orange' ? 'Heavy' : selectedRoad.congestion === 'yellow' ? 'Moderate' : 'Free Flow'}
                        </span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Estimated Delay</span>
                        <span className="detail-stat-value mono">{selectedRoad.estimated_delay} min</span>
                      </div>
                      <div className="detail-stat-card">
                        <span className="detail-stat-label">Affected Load</span>
                        <span className="detail-stat-value mono">{selectedRoad.affected_vehicles}/hr</span>
                      </div>
                    </div>
                  </div>

                  {/* Nearby Hotspots Link List */}
                  <div>
                    <h3 className="drawer-section-title">Linked Hotspots ({selectedRoad.nearby_hotspots.length})</h3>
                    <div className="sim-drawer-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px' }}>
                      {selectedRoad.nearby_hotspots.map((name, i) => {
                        const hs = INITIAL_HOTSPOTS.find(h => h.name === name);
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                            {hs ? (
                              <button 
                                className="section-action" 
                                style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }} 
                                onClick={() => handleSelectHotspot(hs)}
                              >
                                Inspect Hotspot
                              </button>
                            ) : (
                              <span className="mono" style={{ color: 'var(--text-muted)' }}>Inactive</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recharts chart: Speed Comparison */}
                  <div>
                    <h3 className="drawer-section-title">Speed vs Design Threshold</h3>
                    <div style={{ width: '100%', height: 120 }}>
                      <ResponsiveContainer>
                        <BarChart 
                          data={[
                            { name: 'Current Speed', speed: selectedRoad.speed },
                            { name: 'Free Flow Speed', speed: selectedRoad.free_flow_speed }
                          ]} 
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={true} vertical={false} />
                          <XAxis type="number" hide={true} />
                          <YAxis dataKey="name" type="category" style={{ fontSize: 9, fontWeight: 500 }} />
                          <Tooltip 
                            contentStyle={{ fontSize: 10, border: '1px solid var(--border-color)', borderRadius: 6 }} 
                            formatter={(value) => [`${value} km/h`, 'Speed']}
                          />
                          <Bar dataKey="speed" fill={selectedRoad.congestion === 'green' ? 'var(--success-green)' : selectedRoad.congestion === 'yellow' ? '#eab308' : selectedRoad.congestion === 'orange' ? 'var(--warning-orange)' : 'var(--alert-red)'} radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
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
