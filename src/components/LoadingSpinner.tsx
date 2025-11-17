export default function LoadingSpinner() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      color: '#ffffff',
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif'
    }}>
      Loading weather data...
    </div>
  );
}

