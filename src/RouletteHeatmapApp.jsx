import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function RouletteHeatmapApp() {
  const [screen, setScreen] = useState('setup');
  const [session, setSession] = useState(null);
  const [pendingSession, setPendingSession] = useState(null);
  const [data, setData] = useState({});
  const [history, setHistory] = useState([]);
  const [currentCell, setCurrentCell] = useState('0_CW');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const numbers = Array.from({ length: 37 }, (_, i) => i);
  const directions = ['CW', 'ACW'];

  // Session setup
  const [username, setUsername] = useState('');
  const [tableId, setTableId] = useState('');
  const [croupierId, setCroupierId] = useState('');
  const [dialSpeed, setDialSpeed] = useState('medium');
  const [releasePoint, setReleasePoint] = useState('+1');

  const getCellId = (num, dir) => `${num}_${dir}`;
  const [num, dir] = currentCell.split('_');
  const currentNum = parseInt(num);

  // Calculate color based on frequency
  const getColorForFrequency = (count) => {
    if (!count || count === 0) return '#2d3e50'; // dark gray for 0
    
    // Get max count to normalize
    const allCounts = Object.values(data).filter(v => v);
    const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 1;
    
    if (maxCount === 0) return '#2d3e50';
    
    const normalized = count / maxCount; // 0 to 1
    
    if (normalized < 0.33) {
      // Red zone (0-33%)
      return '#ff6b6b';
    } else if (normalized < 0.66) {
      // Yellow zone (33-66%)
      return '#ffd93d';
    } else {
      // Green zone (66-100%)
      return '#6bcf7f';
    }
  };

  // Get text color based on background
  const getTextColor = (bgColor) => {
    if (bgColor === '#2d3e50') return '#999';
    if (bgColor === '#ff6b6b') return '#fff';
    if (bgColor === '#ffd93d') return '#000';
    if (bgColor === '#6bcf7f') return '#000';
    return '#fff';
  };

  // Format session ID
  const createSessionId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${username}_${yy}${mm}${dd}${hh}${min}`;
  };

  // Check for existing session
  useEffect(() => {
    const stored = localStorage.getItem('activeSession');
    if (stored) {
      setPendingSession(JSON.parse(stored));
      setScreen('resume');
    }
  }, []);

  // Start new session
  const handleStartSession = async () => {
    if (!username || !tableId || !croupierId) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    const sessionId = createSessionId();
    const newSession = {
      session_id: sessionId,
      table_id: tableId,
      croupier_id: croupierId,
      dial_speed: dialSpeed,
      release_point: releasePoint,
      created_at: new Date().toISOString(),
      spins: []
    };

    try {
      await supabase.from('sessions').insert([{
        session_id: sessionId,
        table_id: tableId,
        croupier_id: croupierId,
        dial_speed: dialSpeed,
        release_point: releasePoint,
        created_at: new Date().toISOString(),
        status: 'active'
      }]);

      setSession(newSession);
      localStorage.setItem('activeSession', JSON.stringify(newSession));
      setData({});
      setHistory([]);
      setCurrentCell('0_CW');
      setScreen('tracker');
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  // Resume session
  const handleResumeSession = async () => {
    setSession(pendingSession);
    setScreen('tracker');
  };

  const handleNewSession = () => {
    localStorage.removeItem('activeSession');
    setPendingSession(null);
    setScreen('setup');
  };

  // Save spin to Supabase
  const saveSpinToSupabase = async (cellId, value) => {
    if (!session) return;

    const [spinNum, spinDir] = cellId.split('_');
    try {
      await supabase.from('spins').insert([{
        session_id: session.session_id,
        number: parseInt(spinNum),
        direction: spinDir,
        count: parseInt(value),
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error saving spin:', error);
    }
  };

  // Handle input
  const handleInputChange = (cellId, value) => {
    const numValue = value.trim() === '' ? '' : parseInt(value) || '';
    setData(prev => ({
      ...prev,
      [cellId]: numValue
    }));

    if (value.trim() !== '') {
      saveSpinToSupabase(cellId, value);

      const [entryNum, entryDir] = cellId.split('_');
      setHistory(prev => [...prev, {
        number: parseInt(entryNum),
        direction: entryDir,
        value: numValue,
        timestamp: new Date().toLocaleTimeString()
      }]);

      const [currentNum, currentDir] = cellId.split('_');
      let nextCell;

      if (currentDir === 'CW') {
        nextCell = getCellId(currentNum, 'ACW');
      } else {
        nextCell = getCellId(currentNum, 'CW');
      }

      setTimeout(() => {
        setCurrentCell(nextCell);
      }, 100);
    }
  };

  const handleLandedNumber = (landedNum) => {
    setCurrentCell(getCellId(landedNum, 'ACW'));
  };

  const handleInputKeyDown = (e, cellId) => {
    if (e.key === 'Enter') {
      const value = e.target.value.trim();
      if (value !== '') {
        handleInputChange(cellId, value);
        e.target.value = '';
      }
    }
  };

  // Close session
  const handleCloseSession = async () => {
    if (!session) return;

    try {
      await supabase.from('sessions').update({ status: 'closed' }).eq('session_id', session.session_id);
      localStorage.removeItem('activeSession');
      setSession(null);
      setScreen('setup');
    } catch (error) {
      console.error('Error closing session:', error);
    }
  };

  // Export data
  const handleExport = () => {
    const exportData = {
      ...session,
      spins: history
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.session_id}.json`;
    a.click();
  };

  // SETUP SCREEN
  if (screen === 'setup') {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#1a1a2e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#16213e', padding: '40px', borderRadius: '8px', maxWidth: '500px', width: '100%' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#00d4ff' }}>Roulette Tracker</h1>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. mj" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#0f3460', color: '#fff', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Table ID</label>
            <input type="text" value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="e.g. grosv_fireblaze" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#0f3460', color: '#fff', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Croupier ID</label>
            <input type="text" value={croupierId} onChange={(e) => setCroupierId(e.target.value)} placeholder="e.g. ilmar" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#0f3460', color: '#fff', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Dial Speed</label>
            <select value={dialSpeed} onChange={(e) => setDialSpeed(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#0f3460', color: '#fff', boxSizing: 'border-box' }}>
              <option value="slow">Slow</option>
              <option value="medium">Medium</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Release Point</label>
            <select value={releasePoint} onChange={(e) => setReleasePoint(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#0f3460', color: '#fff', boxSizing: 'border-box' }}>
              <option value="+1">+1</option>
              <option value="+2">+2</option>
              <option value="+3">+3</option>
            </select>
          </div>

          <button onClick={handleStartSession} disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#666' : '#00d4ff', color: '#000', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {loading ? 'Creating...' : 'Start Session'}
          </button>
        </div>
      </div>
    );
  }

  // RESUME SCREEN
  if (screen === 'resume' && pendingSession) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#1a1a2e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#16213e', padding: '40px', borderRadius: '8px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '20px', color: '#00d4ff' }}>Active Session</h1>
          <div style={{ backgroundColor: '#0f3460', padding: '20px', borderRadius: '4px', marginBottom: '30px', textAlign: 'left' }}>
            <p><strong>Session ID:</strong> {pendingSession.session_id}</p>
            <p><strong>Table:</strong> {pendingSession.table_id}</p>
            <p><strong>Croupier:</strong> {pendingSession.croupier_id}</p>
            <p><strong>Dial Speed:</strong> {pendingSession.dial_speed}</p>
            <p><strong>Release Point:</strong> {pendingSession.release_point}</p>
          </div>

          <button onClick={handleResumeSession} style={{ width: '100%', padding: '12px', backgroundColor: '#00d4ff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }}>
            Resume Session
          </button>

          <button onClick={handleNewSession} style={{ width: '100%', padding: '12px', backgroundColor: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            New Session
          </button>
        </div>
      </div>
    );
  }

  // TRACKER SCREEN with HEATMAP
  if (screen === 'tracker' && session) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#1a1a2e', color: '#fff', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', color: '#00d4ff' }}>Roulette Heatmap</h1>
            <p style={{ margin: '0', fontSize: '12px', color: '#aaa' }}>Session: {session.session_id}</p>
          </div>
          <button onClick={handleCloseSession} style={{ padding: '8px 16px', backgroundColor: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Close
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#2d3e50', borderRadius: '4px' }}></div>
            <span>0 counts</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#ff6b6b', borderRadius: '4px' }}></div>
            <span>Red (rare)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#ffd93d', borderRadius: '4px' }}></div>
            <span>Yellow (moderate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#6bcf7f', borderRadius: '4px' }}></div>
            <span>Green (frequent)</span>
          </div>
        </div>

        {/* Quick number buttons */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ marginBottom: '8px', fontSize: '12px', color: '#aaa' }}>Quick jump to number:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(35px, 1fr))', gap: '4px' }}>
            {numbers.map(n => (
              <button
                key={n}
                onClick={() => handleLandedNumber(n)}
                style={{
                  padding: '6px',
                  backgroundColor: '#0f3460',
                  color: '#fff',
                  border: '1px solid #16213e',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  transition: 'all 0.1s'
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Current cell indicator */}
        <div style={{ backgroundColor: '#16213e', padding: '10px', borderRadius: '4px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0', fontSize: '12px', color: '#aaa' }}>Entering:</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '18px', color: '#00d4ff', fontWeight: 'bold' }}>{currentNum} {dir}</p>
        </div>

        {/* Heatmap Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '30px' }}>
          {numbers.map(n => (
            <div key={n} style={{ border: '1px solid #16213e', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#0a0e27' }}>
              {/* Number label */}
              <div style={{ backgroundColor: '#16213e', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {n}
              </div>

              {/* CW and ACW cells */}
              {directions.map(d => {
                const cellId = getCellId(n, d);
                const count = data[cellId] || 0;
                const bgColor = getColorForFrequency(count);
                const textColor = getTextColor(bgColor);
                const isActive = currentCell === cellId;

                return (
                  <div
                    key={cellId}
                    style={{
                      padding: '8px',
                      backgroundColor: bgColor,
                      color: textColor,
                      borderTop: '1px solid #16213e',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      border: isActive ? '2px solid #00d4ff' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8 }}>{d}</div>
                    <input
                      ref={isActive ? inputRef : null}
                      type="text"
                      value={data[cellId] || ''}
                      onChange={(e) => handleInputChange(cellId, e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(e, cellId)}
                      onClick={() => setCurrentCell(cellId)}
                      autoFocus={isActive}
                      placeholder="—"
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: isActive ? '2px solid #00d4ff' : `1px solid ${textColor}`,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        color: textColor,
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        outline: 'none',
                        borderRadius: '3px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Export button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              backgroundColor: '#00d4ff',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Export Data
          </button>
        </div>
      </div>
    );
  }

  return null;
}
