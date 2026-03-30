import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Cloud, Cpu, Battery,
  Activity, Smartphone, Car, TreePine, Zap, Plane, Lightbulb
} from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import './GreenComputingPage.css';

// Base models with Carbon estimates (gCO2eq)
const AI_MODELS = {
  'llama-3-8b': { name: 'Llama 3 8B', carbonPerRun: 0.15, category: 'efficient' },
  'mistral-7b': { name: 'Mistral 7B', carbonPerRun: 0.13, category: 'efficient' },
  'mixtral-8x7b': { name: 'Mixtral 8x7B', carbonPerRun: 0.85, category: 'heavy' },
  'gpt-4': { name: 'GPT-4 (Est)', carbonPerRun: 2.50, category: 'heavy' }
};

const CLOUD_REGIONS = {
  'us-west': { name: 'US West (Oregon) - Green Energy', multiplier: 0.4 },
  'us-east': { name: 'US East (N. Virginia)', multiplier: 1.0 },
  'eu-north': { name: 'EU North (Stockholm) - Hydro', multiplier: 0.15 },
  'ap-south': { name: 'AP South (Mumbai)', multiplier: 1.8 }
};

interface GreenComputingPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

// ── Animated counter ─────────────────────────────────────────────────────────
const AnimatedCounter: React.FC<{ value: number; decimals?: number; className?: string }> = ({
  value, decimals = 1, className = ''
}) => {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const duration = 1400;
    const step = 16;
    const increment = value / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <span className={className}>
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
};

// ── World Map Hero Section ───────────────────────────────────────────────────
const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

const MAP_PINS: Array<{
  key: keyof typeof CLOUD_REGIONS;
  coordinates: [number, number];
  label: string; sub: string; mult: number;
}> = [
  { key: 'eu-north', coordinates: [18.0686, 59.3293],  label: 'EU North', sub: 'Stockholm · 0.15×', mult: 0.15 },
  { key: 'us-west',  coordinates: [-120.5, 43.8],      label: 'US West',  sub: 'Oregon · 0.4×',     mult: 0.4  },
  { key: 'us-east',  coordinates: [-78.1, 38.0],       label: 'US East',  sub: 'N. Virginia · 1.0×', mult: 1.0 },
  { key: 'ap-south', coordinates: [72.8777, 19.0760],  label: 'AP South', sub: 'Mumbai · 1.8×',      mult: 1.8  },
];

const pinColor = (mult: number) => {
  if (mult <= 0.4) return '#4ade80';
  if (mult <= 1.0) return '#fbbf24';
  return '#f87171';
};

const WorldMapHero: React.FC<{
  selectedRegion: keyof typeof CLOUD_REGIONS;
  onSelect: (r: keyof typeof CLOUD_REGIONS) => void;
}> = ({ selectedRegion, onSelect }) => {
  const [hovered, setHovered] = React.useState<string | null>(null);

  return (
    <section className="green-world-map-banner">
      <div className="map-hero-text">
        <h2>Global Cloud Infrastructure</h2>
        <p>Datacenter energy sources vary wildly. Selecting a green grid region instantly drops operational emissions.</p>
      </div>
      
      <div className="map-hero-container">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 155 }}
              width={1000}
              height={500}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#183257"
                  stroke="rgba(100, 180, 255, 0.15)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#1f3d6b', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {MAP_PINS.map((pin) => {
            const isSelected = selectedRegion === pin.key;
            const isHovered = hovered === pin.key;
            const col = pinColor(pin.mult);
            return (
              <Marker 
                key={pin.key} 
                coordinates={pin.coordinates}
                onClick={() => onSelect(pin.key)}
                onMouseEnter={() => setHovered(pin.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  default: { cursor: 'pointer' },
                  hover: { cursor: 'pointer' },
                  pressed: { cursor: 'pointer' }
                }}
              >
                {isSelected && (
                  <circle r={28} fill={col} opacity={0.15}>
                    <animate attributeName="r" values="14; 40" dur="1.5s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.3; 0" dur="1.5s" repeatCount="indefinite"/>
                  </circle>
                )}
                <circle r={isSelected ? 10 : (isHovered ? 8 : 6)} fill={col} stroke="#fff" strokeWidth={2} />
                
                {(isSelected || isHovered) && (
                  <g transform={pin.key === 'eu-north' ? "translate(0, 48)" : "translate(0, -28)"}>
                    <rect x="-60" y="-38" width="120" height="42" rx="6" fill="rgba(8, 20, 42, 0.95)" stroke={col} strokeWidth="1.5" />
                    <text textAnchor="middle" y="-18" fontSize="13" fill="#fff" fontWeight="bold" fontFamily="system-ui, sans-serif">{pin.label}</text>
                    <text textAnchor="middle" y="-2" fontSize="11" fill={col} fontFamily="system-ui, sans-serif">{pin.sub}</text>
                    <polygon points={pin.key === 'eu-north' ? "-6,-42 6,-42 0,-49" : "-6,4 6,4 0,11"} fill={col} />
                  </g>
                )}
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      
    
        <div className="map-legend map-hero-legend">
          {MAP_PINS.map(pin => {
            const col = pinColor(pin.mult);
            return (
              <button
                key={pin.key}
                className={`map-legend-btn ${selectedRegion === pin.key ? 'map-legend-active' : ''}`}
                onClick={() => onSelect(pin.key)}
                style={selectedRegion === pin.key ? { borderColor: col, background: col + '15' } : {}}
              >
                <span className="map-legend-dot" style={{ background: col, boxShadow: `0 0 8px ${col}80`, width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' }} />
                <span className="map-legend-name" style={{marginLeft: '8px'}}>{pin.label}</span>
                <span className="map-legend-mult" style={{ color: col }}>{pin.mult}×</span>
              </button>
            );
          })}
        </div>
      </section>
  );
};

// ── Rotating real-world equivalent ───────────────────────────────────────────
const RotatingEquivalent: React.FC<{ savedKg: number }> = ({ savedKg }) => {
  const equivalents = [
    { icon: <Car size={13} />,        text: `≈ ${(savedKg * 4).toFixed(0)} km not driven by car` },
    { icon: <Plane size={13} />,      text: `≈ ${(savedKg / 255).toFixed(1)} Dublin → London flights avoided` },
    { icon: <TreePine size={13} />,   text: `≈ ${(savedKg / 22).toFixed(1)} trees absorbing CO₂ for a year` },
    { icon: <Smartphone size={13} />, text: `≈ ${(savedKg * 122).toFixed(0)} smartphone charges` },
    { icon: <Lightbulb size={13} />,  text: `≈ ${(savedKg * 5.5).toFixed(1)} days of household electricity` },
  ];
  const [index, setIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIndex(i => (i + 1) % 5); setVisible(true); }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, []);
  return (
    <p className="score-equivalent" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
      <span className="score-equiv-icon">{equivalents[index].icon}</span>
      {equivalents[index].text}
    </p>
  );
};

const GreenComputingPage: React.FC<GreenComputingPageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  // Backend tracking state
  const [totalBackendCarbon, setTotalBackendCarbon] = useState<number>(0);
  const [dbRunCount, setDbRunCount] = useState<number>(0);

  // User Interactive Toggles for Presentation
  const [selectedModel, setSelectedModel] = useState<keyof typeof AI_MODELS>('gpt-4');
  const [selectedRegion, setSelectedRegion] = useState<keyof typeof CLOUD_REGIONS>('us-east');
  const [hardwareLifespan, setHardwareLifespan] = useState<number>(3);
  const [scaleFactor, setScaleFactor] = useState<number>(500);
  const [batchingEnabled, setBatchingEnabled] = useState<boolean>(false);

  // Fetch true backend numbers (falls back smoothly if unavail)
  useEffect(() => {
    const fetchRunData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/runs?limit=1000');
        if (res.ok) {
          const data = await res.json();
          setDbRunCount(data.length);
          const totalCarbon = data.reduce((sum: number, run: any) => sum + (run.emissions_g_co2eq || 0.15), 0);
          setTotalBackendCarbon(totalCarbon);
        } else {
          setTotalBackendCarbon(45.5);
          setDbRunCount(350);
        }
      } catch (e) {
        setTotalBackendCarbon(45.5);
        setDbRunCount(350);
      }
    };
    fetchRunData();
  }, []);

  // Use either actual DB base (if significant) or static demo values, scaled by slider
  const simulatedRunCount = Math.max(dbRunCount, 50) * scaleFactor;

  // Calculators for unoptimized vs optimized.
  const calcUnoptimized = () => {
    const usage = simulatedRunCount * AI_MODELS['gpt-4'].carbonPerRun * CLOUD_REGIONS['ap-south'].multiplier;
    const hardware = (150000 / 3);
    return usage + hardware;
  };

  const calcOptimized = () => {
    let usage = simulatedRunCount * AI_MODELS[selectedModel].carbonPerRun * CLOUD_REGIONS[selectedRegion].multiplier;
    if (batchingEnabled) usage *= 0.65;
    const hardware = (150000 / hardwareLifespan);
    return usage + hardware;
  };

  const baseline = calcUnoptimized();
  const currentTotal = calcOptimized();
  const saved = Math.max(0, baseline - currentTotal);
  const percentSaved = Math.round((saved / baseline) * 100);

  const savedKg = saved / 1000;
  const treesSaved = Math.floor(savedKg / 22);
  const carsKmSaved = Math.floor(savedKg * 4);
  const phoneChargesSaved = Math.floor(savedKg * 122);

  // Ring chart: conic-gradient computed inline for live reactivity
  const ringDeg = (percentSaved / 100) * 360;
  const ringBg = `conic-gradient(var(--accent-green, #10b981) 0deg ${ringDeg}deg, var(--border-light) ${ringDeg}deg 360deg)`;

  const co2PerQuery = AI_MODELS[selectedModel].carbonPerRun
    * CLOUD_REGIONS[selectedRegion].multiplier
    * (batchingEnabled ? 0.65 : 1);

  return (
    <div className="green-page">
      <AppSidebar activeItem="green" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <main className="green-main">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="green-header">
          <div className="green-header-left">
            <button className="green-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="green-title">Green Computing Console</h1>
              
            </div>
          </div>
          <div className="green-header-badge">
            <span className="badge-live-dot" />
            Live Data Mode
          </div>
        </header>

        {/* ── Hero Scoreboard ──────────────────────────────────────────── */}
        <section className="green-scoreboard">

          {/* Decorative background orbs */}
          <div className="sb-orb sb-orb-1" />
          <div className="sb-orb sb-orb-2" />

          {/* Column 1: Big savings number */}
          <div className="sb-col sb-col-left">
            <div className="sb-live-row">
              <span className="sb-live-ping" />
              <span className="sb-live-core" />
              <span className="sb-live-label">LIVE</span>
            </div>
            <p className="sb-eyebrow">Total CO₂ Savings</p>
            <div className="sb-big-number">
              <AnimatedCounter value={savedKg} decimals={1} className="sb-big-count" />
              <span className="sb-big-unit">kg CO₂</span>
            </div>
            <RotatingEquivalent savedKg={savedKg} />
            <div className="sb-baseline-note">
              vs. {(baseline / 1000).toFixed(0)}kg industry baseline
            </div>
          </div>

          {/* Column 2: Donut ring */}
          <div className="sb-col sb-col-center">
            <div className="sb-ring-wrap">
              <div className="sb-ring" style={{ background: ringBg, transition: 'background 0.6s ease' }}>
                <div className="sb-ring-hole">
                  <span className="sb-ring-pct">{percentSaved}%</span>
                  <span className="sb-ring-sub">cleaner</span>
                </div>
              </div>
            </div>
            <p className="sb-ring-caption">Below industry standard</p>
          </div>

          {/* Column 3: Stats + comparison bars */}
          <div className="sb-col sb-col-right">
            <div className="sb-stats-row">
              <div className="sb-stat">
                <span className="sb-stat-val">{simulatedRunCount.toLocaleString()}</span>
                <span className="sb-stat-label">Queries / yr</span>
              </div>
              <div className="sb-stat-divider" />
              <div className="sb-stat">
                <span className="sb-stat-val">{co2PerQuery.toFixed(3)}g</span>
                <span className="sb-stat-label">CO₂ per query</span>
              </div>
            </div>

            <div className="sb-compare">
              <div className="sb-compare-row">
                <span className="sb-compare-label">Industry</span>
                <div className="sb-compare-track">
                  <div className="sb-compare-fill sb-compare-fill--industry" style={{ width: '100%' }} />
                </div>
                <span className="sb-compare-val sb-compare-val--industry">{(baseline / 1000).toFixed(0)}kg</span>
              </div>
              <div className="sb-compare-row">
                <span className="sb-compare-label">Optimised</span>
                <div className="sb-compare-track">
                  <div
                    className="sb-compare-fill sb-compare-fill--propylon"
                    style={{ width: `${Math.max(4, 100 - percentSaved)}%`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }}
                  />
                </div>
                <span className="sb-compare-val sb-compare-val--propylon">{(currentTotal / 1000).toFixed(0)}kg</span>
              </div>
            </div>
            <p className="sb-compare-saving">
              ↓ {(((baseline - currentTotal) / baseline) * 100).toFixed(0)}% less than industry standard
            </p>
          </div>

        </section>

        {/* ── Three Module Cards ───────────────────────────────────────── */}

        <section className="green-modules-grid">

          {/* AI Efficiency */}
          <div className="green-module-card module-card-emerald">
            <div className="module-accent module-accent-emerald" />
            <div className="module-header">
              <div className="module-icon bg-emerald"><Cpu size={20} /></div>
              <div className="module-header-text">
                <h2>AI Efficiency</h2>
                <p className="module-desc">Choose models strategically — smaller models use vastly less energy.</p>
              </div>
              <span className="module-live-chip module-live-chip-emerald">
                {(simulatedRunCount * AI_MODELS[selectedModel].carbonPerRun * CLOUD_REGIONS[selectedRegion].multiplier / 1000).toFixed(1)}kg/yr
              </span>
            </div>

            <div className="module-body">
              <span className="input-label">Model Selection</span>
              <div className="button-group">
                <button
                  className={`toggle-btn ${selectedModel === 'mistral-7b' ? 'active-emerald' : ''}`}
                  onClick={() => setSelectedModel('mistral-7b')}
                >
                  <div className="btn-row">
                    <span className="btn-title">Mistral 7B</span>
                    <span className="btn-badge btn-badge-green">Efficient</span>
                  </div>
                  <span className="btn-sub">0.13g CO₂/query</span>
                  <div className="model-bar-track">
                    <div className="model-bar model-bar-green" style={{ width: `${(0.13 / 2.50) * 100}%` }} />
                  </div>
                </button>
                <button
                  className={`toggle-btn ${selectedModel === 'gpt-4' ? 'active-emerald' : ''}`}
                  onClick={() => setSelectedModel('gpt-4')}
                >
                  <div className="btn-row">
                    <span className="btn-title">Heavy LLM (GPT-4)</span>
                    <span className="btn-badge btn-badge-red">Heavy</span>
                  </div>
                  <span className="btn-sub">2.50g CO₂/query</span>
                  <div className="model-bar-track">
                    <div className="model-bar model-bar-red" style={{ width: '100%' }} />
                  </div>
                </button>
              </div>

              <div className="module-stat-row">
                <div className="module-stat-box">
                  <span className="module-stat-val">{simulatedRunCount.toLocaleString()}</span>
                  <span className="module-stat-label">Annual queries</span>
                </div>
                <div className="module-stat-box">
                  <span className="module-stat-val">{AI_MODELS[selectedModel].carbonPerRun}g</span>
                  <span className="module-stat-label">CO₂ per run</span>
                </div>
              </div>
            </div>

            <details className="module-methodology">
              <summary>How we calculate this</summary>
              <p>Carbon per query sourced from ML CO₂ Impact calculator benchmarks. Scaled to {simulatedRunCount.toLocaleString()} annual queries based on live backend usage data.</p>
            </details>
          </div>

          {/* Cloud Infrastructure */}
          <div className="green-module-card module-card-teal">
            <div className="module-accent module-accent-teal" />
            <div className="module-header">
              <div className="module-icon bg-teal"><Cloud size={20} /></div>
              <div className="module-header-text">
                <h2>Cloud Infrastructure</h2>
                <p className="module-desc">Datacenter energy sources vary wildly by region.</p>
              </div>
              <span className="module-live-chip module-live-chip-teal">
                {CLOUD_REGIONS[selectedRegion].multiplier}× grid
              </span>
            </div>

            <div className="module-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--glass-bg-secondary, var(--bg-light))', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '4px' }}>
                  <Cloud size={24} style={{ color: '#0d9488' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>{CLOUD_REGIONS[selectedRegion].name}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Region configured via interactive map below</span>
                  </div>
                </div>

<div className="module-divider" />

              <span className="input-label">Query Architecture</span>
              <div className="switch-container">
                <div>
                  <span className="switch-title">Request Batching</span>
                  <span className="switch-sub">Saves 35% compute overhead</span>
                </div>
                <button
                  className={`switch-toggle ${batchingEnabled ? 'on' : ''}`}
                  onClick={() => setBatchingEnabled(!batchingEnabled)}
                  aria-label="Toggle request batching"
                >
                  <div className={`switch-knob ${batchingEnabled ? 'on' : ''}`} />
                </button>
              </div>
            </div>

            <details className="module-methodology">
              <summary>How we calculate this</summary>
              <p>Regional carbon intensity multipliers based on published grid energy mix data (EU North hydro: 0.15×, US West renewables: 0.4×, US East mixed: 1.0×, AP South coal-heavy: 1.8×).</p>
            </details>
          </div>

          {/* Hardware Lifespan */}
          <div className="green-module-card module-card-lime">
            <div className="module-accent module-accent-lime" />
            <div className="module-header">
              <div className="module-icon bg-lime-light"><Battery size={20} /></div>
              <div className="module-header-text">
                <h2>Hardware Lifespan</h2>
                <p className="module-desc">Extending server life from 3→7 years halves embodied emissions.</p>
              </div>
              <span className="module-live-chip module-live-chip-lime">
                {hardwareLifespan}yr cycle
              </span>
            </div>

            <div className="module-body">
              <div className="slider-header">
                <span className="input-label" style={{ margin: 0 }}>Server Refresh Cycle</span>
                <span className="slider-val text-lime">{hardwareLifespan} Years</span>
              </div>

              <input
                type="range"
                min="3" max="7" step="1"
                value={hardwareLifespan}
                onChange={(e) => setHardwareLifespan(parseInt(e.target.value))}
                className="styled-slider lime-slider"
              />
              <div className="slider-ticks">
                <span>3y</span><span>4y</span><span>5y</span><span>6y</span><span>7y</span>
              </div>

              <div className="hardware-savings-callout">
                <Zap size={14} className="callout-icon" />
                <span>
                  At <strong>{hardwareLifespan} years</strong>: saves{' '}
                  <strong>{((150000 / 3 - 150000 / hardwareLifespan) / 1000).toFixed(1)}kg</strong>{' '}
                  vs 3-year refresh cycle
                </span>
              </div>

              <div className="hardware-bar-section">
                <div className="hardware-bar-labels">
                  {[3,4,5,6,7].map(y => (
                    <span key={y} className={y <= hardwareLifespan ? 'hw-label-active' : ''}>{y}y</span>
                  ))}
                </div>
                <div className="hardware-years">
                  {[1,2,3,4,5,6,7].map(yr => (
                    <div key={yr} className={`hw-year-block ${yr <= hardwareLifespan ? 'active' : ''}`} />
                  ))}
                </div>
              </div>

              <div className="module-stat-row" style={{ marginTop: 12 }}>
                <div className="module-stat-box">
                  <span className="module-stat-val">{(150000 / hardwareLifespan / 1000).toFixed(1)}kg</span>
                  <span className="module-stat-label">Yearly hardware CO₂</span>
                </div>
                <div className="module-stat-box">
                  <span className="module-stat-val">{((150000 / 3 - 150000 / hardwareLifespan) / 1000).toFixed(1)}kg</span>
                  <span className="module-stat-label">Saved vs 3yr</span>
                </div>
              </div>
            </div>

            <details className="module-methodology">
              <summary>How we calculate this</summary>
              <p>Embodied manufacturing emissions estimated at 150,000g CO₂eq per server rack, amortised linearly over lifespan. Source: Green IT industry benchmarks (Greenly, 2022).</p>
            </details>
          </div>

        </section>
{/* ── Real-World Impact Banner ──────────────────────────────────── */}
        <section className="equivalencies-banner">
          <h3 className="eq-title">Real-World Environmental Impact</h3>
          {saved > 0 ? (
            <div className="eq-grid">
              <div className="eq-card">
                <div className="eq-icon"><TreePine size={22} /></div>
                <div className="eq-data">
                  <strong>{treesSaved.toLocaleString()}</strong>
                  <span>Trees absorbing CO₂ for a year</span>
                </div>
              </div>
              <div className="eq-card">
                <div className="eq-icon"><Car size={22} /></div>
                <div className="eq-data">
                  <strong>{carsKmSaved.toLocaleString()} km</strong>
                  <span>Not driven by gasoline car</span>
                </div>
              </div>
              <div className="eq-card">
                <div className="eq-icon"><Smartphone size={22} /></div>
                <div className="eq-data">
                  <strong>{phoneChargesSaved.toLocaleString()}</strong>
                  <span>Smartphone charges saved</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              Adjust the controls above to see your environmental impact.
            </div>
          )}
        </section>

      

        {/* ── Global Cloud Infrastructure Map ─── */}
        <WorldMapHero selectedRegion={selectedRegion} onSelect={setSelectedRegion} />

        
        </main>
    </div>
  );
};

export default GreenComputingPage;
