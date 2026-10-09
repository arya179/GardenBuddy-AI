import { useState, useEffect } from 'react';
import { checkHealth, askAdvisor } from './api';
import './App.css';

const PLANT_DATA = [
  { id: 1, name: 'Tomato', season: 'Summer', sunlight: 'Full Sun', watering: 'Daily', container: true },
  { id: 2, name: 'Basil', season: 'Summer', sunlight: 'Partial Sun', watering: 'Regular', container: true },
  { id: 3, name: 'Zucchini', season: 'Summer', sunlight: 'Full Sun', watering: 'Regular', container: false },
  { id: 4, name: 'Lettuce', season: 'Spring/Fall', sunlight: 'Partial Sun', watering: 'Regular', container: true },
  { id: 5, name: 'Carrot', season: 'Spring/Fall', sunlight: 'Full Sun', watering: 'Regular', container: false },
];

function App() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('gardenTasks');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, text: 'Water the Monstera', completed: false },
      { id: 2, text: 'Prune the Fiddle Leaf Fig', completed: false },
      { id: 3, text: 'Repot the Snake Plant', completed: true },
    ];
  });

  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem('gardenPrefs');
    if (saved) return JSON.parse(saved);
    return { sunlight: '', space: '' };
  });

  const [recommendations, setRecommendations] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  
  const [question, setQuestion] = useState('');
  const [backendStatus, setBackendStatus] = useState('loading'); 
  const [advisorState, setAdvisorState] = useState({ loading: false, answer: null, error: null });

  useEffect(() => {
    localStorage.setItem('gardenTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('gardenPrefs', JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const initHealthCheck = async () => {
      setBackendStatus('loading');
      const result = await checkHealth();
      setBackendStatus(result.success ? 'connected' : 'disconnected');
    };
    initHealthCheck();
  }, []);

  const toggleTask = (id) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  };

  const handleAdvisorSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAdvisorState({ loading: true, answer: null, error: null });
    const result = await askAdvisor(question);
    if (result.success) {
      setAdvisorState({ loading: false, answer: result.answer, error: null });
      setQuestion('');
    } else {
      setAdvisorState({ loading: false, answer: null, error: result.error });
    }
  };

  const findPlants = async (e) => {
    e.preventDefault();
    if (!prefs.sunlight || !prefs.space) return;
    
    const recs = PLANT_DATA.filter(p => {
      const matchSun = p.sunlight === prefs.sunlight || prefs.sunlight === 'Any';
      const matchSpace = prefs.space === 'Garden' ? true : p.container;
      return matchSun && matchSpace;
    });
    setRecommendations(recs);

    if (backendStatus === 'connected' && recs.length > 0) {
      setAiExplanation("Loading AI insights...");
      const plantNames = recs.map(r => r.name).join(', ');
      const res = await askAdvisor(`In two short sentences, why are ${plantNames} good for ${prefs.sunlight} light and ${prefs.space} space?`);
      if (res.success) {
        setAiExplanation(res.answer);
      } else {
        setAiExplanation("AI explanation unavailable at this time.");
      }
    } else {
      setAiExplanation(null);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const remainingCount = tasks.length - completedCount;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2>🌿 GardenBuddy AI</h2>
        <div className="connection-status" style={{ fontSize: '0.85rem', marginBottom: '24px', opacity: 0.8 }}>
          Backend: {backendStatus === 'loading' ? '⏳ Checking...' : backendStatus === 'connected' ? '✅ Connected' : '❌ Disconnected'}
        </div>
        <nav className="nav-links">
          <div className="nav-link active">Dashboard</div>
        </nav>
      </aside>

      <main className="main-content">
        <section className="welcome-section">
          <h1>Welcome back, Gardener!</h1>
          <p>Here is your garden's status for today.</p>
        </section>

        <section className="stats-grid">
          <div className="stat-card"><h3>Remaining Tasks</h3><p className="value">{remainingCount}</p></div>
          <div className="stat-card"><h3>Completed Tasks</h3><p className="value">{completedCount}</p></div>
        </section>

        <section className="content-grid">
          <div className="card">
            <h2>Today's Tasks</h2>
            <div className="task-list">
              {tasks.length === 0 && <p>No tasks yet!</p>}
              {tasks.map(task => (
                <label key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <input type="checkbox" className="task-checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                  <span>{task.text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Plant Finder</h2>
            <form className="advisor-form" onSubmit={findPlants}>
              <select className="advisor-input" style={{minHeight: '40px'}} value={prefs.sunlight} onChange={e => setPrefs({...prefs, sunlight: e.target.value})} required>
                <option value="">Select Sunlight...</option>
                <option value="Full Sun">Full Sun</option>
                <option value="Partial Sun">Partial Sun</option>
                <option value="Any">Any</option>
              </select>
              <select className="advisor-input" style={{minHeight: '40px'}} value={prefs.space} onChange={e => setPrefs({...prefs, space: e.target.value})} required>
                <option value="">Select Space...</option>
                <option value="Container">Containers / Pots</option>
                <option value="Garden">Garden Bed</option>
              </select>
              <button type="submit" className="advisor-btn">Find Plants</button>
            </form>
            <p style={{fontSize: '0.8rem', color: '#666', marginTop: '8px'}}>* Recommendations are suggestions based on standard growing conditions.</p>

            {recommendations !== null && (
              <div style={{marginTop: '16px'}}>
                {recommendations.length > 0 ? (
                  <>
                    <h4>Recommended for you:</h4>
                    <ul style={{paddingLeft: '20px', margin: '8px 0'}}>
                      {recommendations.map(r => <li key={r.id}><strong>{r.name}</strong> ({r.season}, {r.watering} watering)</li>)}
                    </ul>
                    {aiExplanation && (
                      <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.9rem', marginTop: '12px' }}>
                        <strong>✨ AI Insight:</strong> {aiExplanation}
                      </div>
                    )}
                  </>
                ) : (
                  <p>No plants found for these specific conditions. Try adjusting your preferences!</p>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>AI Plant Advisor <span style={{fontSize: '0.8rem', background: '#e9edc9', padding: '2px 6px', borderRadius: '4px'}}>✨ AI-Generated</span></h2>
            <form className="advisor-form" onSubmit={handleAdvisorSubmit}>
              <textarea className="advisor-input" placeholder="Ask about your plants..." value={question} onChange={(e) => setQuestion(e.target.value)} disabled={advisorState.loading} />
              <button type="submit" className="advisor-btn" disabled={advisorState.loading || !question.trim()}>
                {advisorState.loading ? 'Asking AI...' : 'Ask AI'}
              </button>
            </form>
            {advisorState.error && <div style={{ marginTop: '16px', padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', fontSize: '0.9rem' }}><strong>Error:</strong> {advisorState.error}</div>}
            {advisorState.answer && <div style={{ marginTop: '16px', padding: '16px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px' }}><h4 style={{ margin: '0 0 8px 0', color: '#354f52' }}>Advisor says:</h4><p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.95rem' }}>{advisorState.answer}</p></div>}
            {backendStatus === 'disconnected' && <p className="not-connected-msg">⚠️ Backend is disconnected. The AI advisor will not work.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
