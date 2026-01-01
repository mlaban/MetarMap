import { FlightCategory, FlightCategoryColors } from '../types/flightCategory';
import { RadarSource, RadarSourceLabels } from '../types/radar';

interface StatusBarProps {
  lastUpdate: Date | null;
  isRefreshing: boolean;
  windToggleEnabled: boolean;
  onWindToggleChange: (enabled: boolean) => void;
  showAirportLabels: boolean;
  onShowAirportLabelsChange: (show: boolean) => void;
  showRadar: boolean;
  onShowRadarChange: (show: boolean) => void;
  radarSource: RadarSource;
  onRadarSourceChange: (source: RadarSource) => void;
  showSatellite: boolean;
  onShowSatelliteChange: (show: boolean) => void;
  autoMoveEnabled: boolean;
  onAutoMoveChange: (enabled: boolean) => void;
}

const LegendDot = ({ color, label }: { color: string; label: string }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          border: `0.5px solid ${color}`,
          filter: `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 4px ${color}) drop-shadow(0 0 6px ${color})`,
          position: 'relative'
        }}
      >
        {/* Bright center core */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))'
          }}
        />
      </div>
      <span>{label}</span>
    </div>
  );
};

const BlinkingLegendDot = ({ color, label }: { color: string; label: string }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        className="airport-marker-gust"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          border: `0.5px solid ${color}`,
          filter: `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 4px ${color}) drop-shadow(0 0 6px ${color})`,
          position: 'relative'
        }}
      >
        {/* Bright center core */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))'
          }}
        />
      </div>
      <span>{label}</span>
    </div>
  );
};

export default function StatusBar({ lastUpdate, isRefreshing, windToggleEnabled, onWindToggleChange, showAirportLabels, onShowAirportLabelsChange, showRadar, onShowRadarChange, radarSource, onRadarSourceChange, showSatellite, onShowSatelliteChange, autoMoveEnabled, onAutoMoveChange }: StatusBarProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#ffffff',
      padding: '10px 20px',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        {isRefreshing ? (
          <span>Refreshing weather data...</span>
        ) : (
          <span>
            Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <LegendDot color={FlightCategoryColors[FlightCategory.VFR]} label="VFR" />
          <LegendDot color={FlightCategoryColors[FlightCategory.MVFR]} label="MVFR" />
          <LegendDot color={FlightCategoryColors[FlightCategory.IFR]} label="IFR" />
          <LegendDot color={FlightCategoryColors[FlightCategory.LIFR]} label="LIFR" />
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: '20px', paddingLeft: '20px', borderLeft: '1px solid #444' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Wind:</span>
          <LegendDot color="#FF00FF" label=">40" />
          <LegendDot color="#FF0000" label=">30" />
          <LegendDot color="#FF8000" label=">20" />
          <LegendDot color="#0080FF" label=">15" />
          <LegendDot color="#00FF00" label="<15" />
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: '20px', paddingLeft: '20px', borderLeft: '1px solid #444' }}>
          <BlinkingLegendDot color={FlightCategoryColors[FlightCategory.VFR]} label="Blinking = Gusts ≥17kt" />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px', paddingLeft: '20px', borderLeft: '1px solid #444' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={windToggleEnabled}
              onChange={(e) => onWindToggleChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#4CAF50'
              }}
            />
            <span style={{ color: '#cccccc' }}>Wind Toggle</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showAirportLabels}
              onChange={(e) => onShowAirportLabelsChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#4CAF50'
              }}
            />
            <span style={{ color: '#cccccc' }}>Show Labels</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={showRadar}
                onChange={(e) => onShowRadarChange(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#4CAF50'
                }}
              />
              <span style={{ color: '#cccccc' }}>Radar</span>
            </label>
            {showRadar && (
              <select
                value={radarSource}
                onChange={(e) => onRadarSourceChange(e.target.value as RadarSource)}
                style={{
                  backgroundColor: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  fontSize: '11px',
                  padding: '2px 4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {Object.entries(RadarSourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={autoMoveEnabled}
              onChange={(e) => onAutoMoveChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#4CAF50'
              }}
            />
            <span style={{ color: '#cccccc' }}>Auto Move</span>
          </label>
          {/* Satellite layer disabled - tiles not working properly */}
          {/* <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showSatellite}
              onChange={(e) => onShowSatelliteChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#4CAF50'
              }}
            />
            <span style={{ color: '#cccccc' }}>Satellite</span>
          </label> */}
        </div>
      </div>
    </div>
  );
}

