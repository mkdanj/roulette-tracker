import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
export default function RouletteTrackerProduction() {
  const [screen, setScreen] = useState('lobby');
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [spins, setSpins] = useState([]);
  const [history, setHistory] = useState({});
  const [tableName, setTableName] = useState('');
  const [croupierName, setCroupierName] = useState('');
  const [startNumber, setStartNumber] = useState('');
  const [direction, setDirection] = useState('CW');
  const [landingNumber, setLandingNumber] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  useEffect(() => {
    loadSessions();
  }, []);
  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };
  const handleCreateSession = async () => {
    if (!tableName || !croupierName) {
      alert('Fill Table Name and Croupier Name!');
      return;
    }
    const sessionId = `${tableName}_${croupierName}_${new Date().toISOString().slice(2, 13).replace(/[-:]/g, '')}`;
    const newSession = {
      session_id: sessionId,
      table_name: tableName,
      croupier_name: croupierName,
      start_time: new Date().toISOString(),
      spin_count: 0,
      status: 'active',
    };
    try {
      const { error } = await supabase.from('sessions').insert(newSession);
      if (error) throw error;
      setCurrentSession(newSession);
      setSpins([]);
      setHistory({});
      setScreen('tracker');
      setTableName('');
      setCroupierName('');
      loadSessions();
    } catch (error) {
      alert('Error creating session: ' + error.message);
    }
  };
  const handleRecordSpin = async () => {
    if (!startNumber || !landingNumber) {
      alert('Fill Start Number and Landing Number!');
      return;
    }
    const spin = {
      start: parseInt(startNumber),
      direction,
      landing: parseInt(landingNumber),
      timestamp: new Date().toISOString(),
    };
    let updatedSpins;
    if (editingIndex !== null) {
      updatedSpins = [...spins];
      updatedSpins[editingIndex] = spin;
      setEditingIndex(null);
    } else {
      updatedSpins = [...spins, spin];
    }
    setSpins(updatedSpins);
    updateHistory(updatedSpins);
    try {
      const spinData = {
        session_id: currentSession.session_id,
        table_name: currentSession.table_name,
        croupier_name: currentSession.croupier_name,
        start_number: spin.start,
        direction: spin.direction,
        landing_number: spin.landing,
        spin_order: updatedSpins.length,
      };
      const { error } = await supabase.from('spins').insert(spinData);
      if (error) throw error;
    } catch (error) {
      console.error('Error saving spin:', error);
    }
    setStartNumber('');
    setLandingNumber('');
    setDirection('CW');
  };
  const updateHistory = (updatedSpins) => {
    const newHistory = {};
    updatedSpins.forEach((s) => {
      const key = `${s.landing}`;
      if (!newHistory[key]) {
        newHistory[key] = { CW: {}, ACW: {} };
      }
      const startKey = `${s.start}`;
      if (!newHistory[key][s.direction][startKey]) {
        newHistory[key][s.direction][startKey] = 0;
      }
      newHistory[key][s.direction][startKey]++;
    });
    setHistory(newHistory);
  };
  const handleUndo = () => {
    if (spins.length === 0) return;
    const updatedSpins = spins.slice(0, -1);
    setSpins(updatedSpins);
    updateHistory(updatedSpins);
  };
  const handleEdit = (index) => {
    const spin = spins[index];
    setStartNumber(spin.start.toString());
    setDirection(spin.direction);
    setLandingNumber(spin.landing.toString());
    setEditingIndex(index);
  };
  const handleEndSession = async () => {
    if (!currentSession) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          end_time: new Date().toISOString(),
          spin_count: spins.length,
          status: 'completed',
        })
        .eq('session_id', currentSession.session_id);
      if (error) throw error;
      setCurrentSession(null);
      setSpins([]);
      setHistory({});
      setScreen('dashboard');
      loadSessions();
    } catch (error) {
      alert('Error ending session: ' + error.message);
    }
  };
  const getLandingHistory = () => {
    if (!landingNumber) return null;
    return history[landingNumber] || null;
  };
  const landingHist = getLandingHistory();
  if (screen === 'lobby') {
    return (
      <div style={styles.container}>
        <div style={styles.lobbyBox}>
          <h1 style={styles.title}>🎲 Roulette Tracker</h1>
          <p style={styles.subtitle}>Professional Casino Analytics</p>
          <div style={styles.lobbyButtons}>
            <button
              onClick={() => setScreen('sessionForm')}
              style={styles.btnPrimary}
            >
              ➕ Start New Session
            </button>
            <button
              onClick={() => setScreen('dashboard')}
              style={styles.btnSecondary}
            >
              📊 View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (screen === 'sessionForm') {
    return (
      <div style={styles.container}>
        <div style={styles.formBox}>
          <h1 style={styles.title}>📝 New Session</h1>
          <div style={styles.formGroup}>
            <label>Table Name:</label>
            <input
              type="text"
              placeholder="e.g. Green, Red, Table 7"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label>Croupier Name:</label>
            <input
              type="text"
              placeholder="e.g. Ilmar, Maria, James"
              value={croupierName}
              onChange={(e) => setCroupierName(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.formButtons}>
            <button onClick={handleCreateSession} style={styles.btnPrimary}>
              ✓ Start Session
            </button>
            <button
              onClick={() => setScreen('lobby')}
              style={styles.btnSecondary}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (screen === 'tracker' && currentSession) {
    return (
      <div style={styles.container}>
        <div style={styles.trackerBox}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>🎲 Tracker</h1>
              <p style={styles.sessionInfo}>
                Table: <strong>{currentSession.table_name}</strong> | Croupier:{' '}
                <strong>{currentSession.croupier_name}</strong>
              </p>
              <p style={styles.spinCount}>Spins: {spins.length}</p>
            </div>
            <button onClick={handleEndSession} style={styles.btnDanger}>
              ⏹ End Session
            </button>
          </div>
          <div style={styles.inputSection}>
            <h2 style={styles.sectionTitle}>Enter Spin Data</h2>
            <div style={styles.inputGrid}>
              <div style={styles.inputGroup}>
                <label>Start Number (0-36):</label>
                <input
                  type="number"
                  min="0"
                  max="36"
                  placeholder="16"
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label>Direction:</label>
                <div style={styles.directionButtons}>
                  <button
                    onClick={() => setDirection('CW')}
                    style={{
                      ...styles.btnDirection,
                      ...(direction === 'CW' ? styles.btnActive : {}),
                    }}
                  >
                    ↻ CW
                  </button>
                  <button
                    onClick={() => setDirection('ACW')}
                    style={{
                      ...styles.btnDirection,
                      ...(direction === 'ACW' ? styles.btnActive : {}),
                    }}
                  >
                    ↷ ACW
                  </button>
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label>Landed on (0-36):</label>
                <input
                  type="number"
                  min="0"
                  max="36"
                  placeholder="7"
                  value={landingNumber}
                  onChange={(e) => setLandingNumber(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.buttonGroup}>
              <button onClick={handleRecordSpin} style={styles.btnPrimary}>
                {editingIndex !== null ? '✎ Update' : '✓ Record'}
              </button>
              {editingIndex !== null && (
                <button
                  onClick={() => setEditingIndex(null)}
                  style={styles.btnSecondary}
                >
                  ✕ Cancel
                </button>
              )}
              <button onClick={handleUndo} style={styles.btnDanger}>
                ↶ Undo
              </button>
            </div>
          </div>
          {landingHist && (
            <div style={styles.historySection}>
              <h2 style={styles.sectionTitle}>
                History: Number {landingNumber} as Starting Point
              </h2>
              {Object.keys(landingHist.CW).length > 0 && (
                <div style={styles.historyBox}>
                  <h3 style={styles.historyTitle}>↻ From {landingNumber} CW:</h3>
                  <div style={styles.historyList}>
                    {Object.entries(landingHist.CW)
                      .sort((a, b) => b[1] - a[1])
                      .map(([num, count]) => (
                        <div key={`cw-${num}`} style={styles.historyItem}>
                          → {num} <span style={styles.count}>({count})</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {Object.keys(landingHist.ACW).length > 0 && (
                <div style={styles.historyBox}>
                  <h3 style={styles.historyTitle}>
                    ↷ From {landingNumber} ACW:
                  </h3>
                  <div style={styles.historyList}>
                    {Object.entries(landingHist.ACW)
                      .sort((a, b) => b[1] - a[1])
                      .map(([num, count]) => (
                        <div key={`acw-${num}`} style={styles.historyItem}>
                          → {num} <span style={styles.count}>({count})</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {spins.length > 0 && (
            <div style={styles.spinsSection}>
              <h2 style={styles.sectionTitle}>Recorded Spins ({spins.length})</h2>
              <div style={styles.spinsList}>
                {spins.map((spin, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.spinItem,
                      ...(editingIndex === idx ? styles.spinEditing : {}),
                    }}
                  >
                    <span style={styles.spinText}>
                      {idx + 1}. {spin.start} {spin.direction} → {spin.landing}
                    </span>
                    <button
                      onClick={() => handleEdit(idx)}
                      style={styles.btnSmall}
                    >
                      ✎ Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (screen === 'dashboard') {
    return (
      <div style={styles.container}>
        <div style={styles.dashboardBox}>
          <div style={styles.dashboardHeader}>
            <h1 style={styles.title}>📊 Dashboard</h1>
            <button onClick={() => setScreen('lobby')} style={styles.btnClose}>
              ← Back to Lobby
            </button>
          </div>
          {sessions.length === 0 ? (
            <p style={styles.noData}>No sessions recorded yet</p>
          ) : (
            <div style={styles.sessionsList}>
              {sessions.map((session) => (
                <div key={session.session_id} style={styles.sessionCard}>
                  <div style={styles.sessionCardHeader}>
                    <h3 style={styles.sessionCardTitle}>
                      {session.table_name} → {session.croupier_name}
                    </h3>
                    <span
                      style={{
                        ...styles.sessionStatus,
                        ...(session.status === 'active'
                          ? styles.statusActive
                          : styles.statusCompleted),
                      }}
                    >
                      {session.status === 'active' ? '🔴 Active' : '✓ Completed'}
                    </span>
                  </div>
                  <div style={styles.sessionCardDetails}>
                    <p>📝 Session ID: {session.session_id}</p>
                    <p>🎲 Spins Recorded: {session.spin_count || 0}</p>
                    <p>
                      ⏱️ Started:{' '}
                      {new Date(session.start_time).toLocaleString()}
                    </p>
                    {session.end_time && (
                      <p>
                        🏁 Ended:{' '}
                        {new Date(session.end_time).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={styles.dashboardStats}>
            <h2 style={styles.statsTitle}>📈 Overall Statistics</h2>
            <div style={styles.statItem}>
              <span>Total Sessions:</span>
              <strong>{sessions.length}</strong>
            </div>
            <div style={styles.statItem}>
              <span>Total Spins:</span>
              <strong>
                {sessions.reduce((sum, s) => sum + (s.spin_count || 0), 0)}
              </strong>
            </div>
            <div style={styles.statItem}>
              <span>Active Sessions:</span>
              <strong>
                {sessions.filter((s) => s.status === 'active').length}
              </strong>
            </div>
            <div style={styles.statItem}>
              <span>Completed Sessions:</span>
              <strong>
                {sessions.filter((s) => s.status === 'completed').length}
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0e27',
    color: '#fff',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  lobbyBox: {
    maxWidth: '500px',
    margin: '100px auto',
    backgroundColor: '#1a2a4e',
    padding: '50px 40px',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 255, 255, 0.1)',
  },
  formBox: {
    maxWidth: '500px',
    margin: '50px auto',
    backgroundColor: '#1a2a4e',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 255, 255, 0.1)',
  },
  trackerBox: {
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: '#1a2a4e',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 255, 255, 0.1)',
  },
  dashboardBox: {
    maxWidth: '1000px',
    margin: '0 auto',
    backgroundColor: '#1a2a4e',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 255, 255, 0.1)',
  },
  title: {
    fontSize: '32px',
    color: '#00ffff',
    marginBottom: '10px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    textAlign: 'center',
    marginBottom: '40px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #00ffff',
  },
  sessionInfo: {
    fontSize: '14px',
    color: '#aaa',
    margin: '5px 0',
  },
  spinCount: {
    fontSize: '16px',
    color: '#00ff88',
    fontWeight: 'bold',
    margin: '10px 0 0 0',
  },
  formGroup: {
    marginBottom: '20px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  inputGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginTop: '8px',
    backgroundColor: '#0f1e3d',
    border: '2px solid #00ffff',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  directionButtons: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
  },
  btnDirection: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#0f1e3d',
    border: '2px solid #444',
    color: '#888',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnActive: {
    backgroundColor: '#00ffff',
    color: '#000',
    border: '2px solid #00ffff',
    fontWeight: 'bold',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
  },
  formButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '30px',
  },
  lobbyButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  btnPrimary: {
    padding: '12px 24px',
    backgroundColor: '#00ffff',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '12px 24px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '12px 24px',
    backgroundColor: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnClose: {
    padding: '8px 16px',
    backgroundColor: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  sectionTitle: {
    fontSize: '18px',
    color: '#00ffff',
    marginBottom: '15px',
    borderBottom: '2px solid #00ffff',
    paddingBottom: '10px',
  },
  inputSection: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: '#0f1e3d',
    borderRadius: '8px',
  },
  historySection: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: '#0f1e3d',
    borderRadius: '8px',
  },
  historyBox: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#1a2a4e',
    borderRadius: '6px',
    border: '1px solid #00ffff',
  },
  historyTitle: {
    fontSize: '16px',
    color: '#00ffff',
    marginBottom: '10px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    padding: '8px 12px',
    backgroundColor: '#0a0e27',
    borderRadius: '4px',
    fontSize: '14px',
  },
  count: {
    color: '#00ff88',
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  spinsSection: {
    padding: '20px',
    backgroundColor: '#0f1e3d',
    borderRadius: '8px',
  },
  spinsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  spinItem: {
    padding: '12px',
    backgroundColor: '#1a2a4e',
    borderRadius: '6px',
    border: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spinEditing: {
    border: '2px solid #00ffff',
    backgroundColor: '#1a3a6e',
  },
  spinText: {
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  btnSmall: {
    padding: '6px 12px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
  },
  sessionsList: {
    display: 'grid',
    gap: '20px',
    marginBottom: '40px',
  },
  sessionCard: {
    backgroundColor: '#0f1e3d',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #00ffff',
  },
  sessionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  sessionCardTitle: {
    fontSize: '18px',
    color: '#00ffff',
    margin: 0,
  },
  sessionStatus: {
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  statusActive: {
    backgroundColor: '#ff6644',
    color: '#fff',
  },
  statusCompleted: {
    backgroundColor: '#44ff88',
    color: '#000',
  },
  sessionCardDetails: {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: '1.6',
  },
  dashboardStats: {
    backgroundColor: '#0f1e3d',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #00ffff',
  },
  statsTitle: {
    fontSize: '16px',
    color: '#00ffff',
    marginBottom: '15px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #333',
    fontSize: '14px',
  },
  noData: {
    textAlign: 'center',
    color: '#666',
    padding: '40px 20px',
    fontSize: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#aaa',
  },
};
