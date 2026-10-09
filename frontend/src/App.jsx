import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { checkHealth, askAdvisor, getTasks, toggleTaskCompletion, getPreferences, savePreferences } from './api';
import { PLANT_DATA } from './plantData';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [prefs, setPrefs] = useState({ sunlight: '', space: '', searchQuery: '' });

  const [recommendations, setRecommendations] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [findingPlants, setFindingPlants] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [customPlantName, setCustomPlantName] = useState('');
  const [myPlants, setMyPlants] = useState([]);
  
  const GARDEN_TIPS = [
    "Water your plants deeply but less frequently to encourage strong, drought-resistant root systems.",
    "Group plants with similar water and light needs together to make watering easier.",
    "Wipe dust off indoor plant leaves with a damp cloth so they can photosynthesize efficiently.",
    "Check the soil moisture with your finger before watering. If the top inch is dry, it's usually time to water.",
    "Rotate your indoor plants a quarter-turn every week so they grow evenly towards the light.",
    "Don't throw away eggshells! Crush them and sprinkle around plants to add calcium and deter slugs."
  ];
  const tipOfTheDay = GARDEN_TIPS[new Date().getDate() % GARDEN_TIPS.length];
  const [suggestingTasks, setSuggestingTasks] = useState(false);
  const [checkingCompanions, setCheckingCompanions] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [question, setQuestion] = useState('');
  const [backendStatus, setBackendStatus] = useState('loading'); 
  const [advisorState, setAdvisorState] = useState({ loading: false, answer: null, error: null });

  useEffect(() => {
    const fetchData = async () => {
      const dbTasks = await getTasks();
      setTasks(dbTasks.map(t => ({ id: t.id, text: t.title, completed: t.completed, due_date: t.due_date })));
      const dbPrefs = await getPreferences();
      setPrefs({ 
        sunlight: dbPrefs.sunlight || '', 
        space: dbPrefs.space || '', 
        searchQuery: '', 
        experience: '',
        gardenType: dbPrefs.gardenType || '',
        climateZone: dbPrefs.climateZone || ''
      });
      import('./api').then(async ({ getPlants }) => {
        const dbPlants = await getPlants();
        setMyPlants(dbPlants);
      });
    };
    fetchData();
  }, []);

  useEffect(() => {
    const initHealthCheck = async () => {
      setBackendStatus('loading');
      const result = await checkHealth();
      if (result.success) {
        setBackendStatus(result.data.ai_model_status === 'available' ? 'fully_connected' : 'backend_only');
      } else {
        setBackendStatus('disconnected');
      }
    };
    initHealthCheck();
  }, []);

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = !task.completed;
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: newStatus } : t));
    await toggleTaskCompletion(id, newStatus);
  };

  const removeTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    setTasks(tasks.filter(t => t.id !== id));
    import('./api').then(async ({ deleteTask }) => {
      await deleteTask(id);
    });
  };

  const handlePrefChange = async (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await savePreferences(newPrefs);
  };

  const handleAddTask = async (e, titleOverride = null) => {
    if (e) e.preventDefault();
    const title = titleOverride || newTaskTitle;
    if (!title.trim()) return;
    
    // Optimistic UI update
    const tempId = Date.now();
    setTasks([...tasks, { id: tempId, text: title, completed: false, due_date: selectedDate }]);
    if (!titleOverride) setNewTaskTitle('');
    
    import('./api').then(async ({ addTask }) => {
      const created = await addTask({ title, due_date: selectedDate });
      if (created) {
        setTasks(prev => prev.map(t => t.id === tempId ? { id: created.id, text: created.title, completed: created.completed, due_date: created.due_date } : t));
      }
    });
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

  const handleAddPlant = (plant) => {
    if (!myPlants.find(p => p.name === plant.name)) {
      // Optimistic update
      const tempPlant = { id: Date.now(), ...plant };
      setMyPlants([...myPlants, tempPlant]);
      // Also add a task to water it
      handleAddTask(null, `Water the ${plant.name}`);

      import('./api').then(async ({ addPlant }) => {
        const savedPlant = await addPlant({
          name: plant.name,
          species: plant.species,
          sunlight: plant.sunlight,
          watering: plant.watering,
          container: plant.container || false,
          notes: plant.notes
        });
        if (savedPlant) {
          setMyPlants(prev => prev.map(p => p.id === tempPlant.id ? savedPlant : p));
        }
      });
    }
  };

  const handleSuggestTasks = async () => {
    if (myPlants.length === 0) {
      alert("Add some plants to My Garden first!");
      return;
    }
    setSuggestingTasks(true);
    const plantNames = myPlants.map(p => p.name).join(', ');
    const profileContext = prefs.climateZone ? ` I live in ${prefs.climateZone} and garden in a ${prefs.gardenType || 'standard space'}.` : '';
    const res = await askAdvisor(`Based on my garden containing: ${plantNames}.${profileContext} Suggest exactly 2 brief practical gardening tasks I should do today. Format as a bulleted list.`);
    setSuggestingTasks(false);
    if (res.success) {
      setQuestion(`Suggested tasks:\n${res.answer}`);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
      alert("Failed to get suggestions. " + res.error);
    }
  };

  const handleCompanionCheck = async () => {
    if (myPlants.length < 2) {
      alert("Add at least two plants to My Garden to check compatibility!");
      return;
    }
    setCheckingCompanions(true);
    const plantNames = myPlants.map(p => p.name).join(', ');
    const curatedRules = `
    CURATED COMPANION RULES:
    1. Tomato and Basil: Commonly suggested traditional combination.
    2. Carrots and Onions: Traditional combination.
    3. Beans and Corn: Good where conditions are suitable.
    4. Marigolds: Ornamental addition, but does not prevent all pests.
    Do not guarantee pest prevention, improved yields, or disease control. Explain traditional vs proven evidence. Do not invent compatibility facts outside these rules.
    `;
    const res = await askAdvisor(`I am growing: ${plantNames}. Based ONLY on these curated rules, provide a companion planting compatibility analysis for my garden. If my plants aren't in the rules, state that there is no curated traditional data for them.`, curatedRules);
    setCheckingCompanions(false);
    if (res.success) {
      setQuestion(`Companion analysis:\n${res.answer}`);
      document.getElementById('ai-advisor-section').scrollIntoView({ behavior: 'smooth' });
    } else {
      alert("Failed to get analysis. " + res.error);
    }
  };

  const findPlants = async (e) => {
    e.preventDefault();
    if (findingPlants) return;
    
    setFindingPlants(true);
    const recs = PLANT_DATA.filter(p => {
      const matchSun = !prefs.sunlight || p.sunlight === prefs.sunlight || prefs.sunlight === 'Any';
      const matchSpace = !prefs.space || prefs.space === 'Garden' ? true : p.container;
      const matchExp = !prefs.experience || p.experience === prefs.experience || !p.experience;
      const matchSearch = !prefs.searchQuery || p.name.toLowerCase().includes(prefs.searchQuery.toLowerCase()) || p.notes.toLowerCase().includes(prefs.searchQuery.toLowerCase());
      return matchSun && matchSpace && matchSearch && matchExp;
    });
    setRecommendations(recs);

    if (backendStatus === 'fully_connected' && recs.length > 0) {
      setAiExplanation(null);
      const plantNames = recs.map(r => r.name).join(', ');
      const plantContext = JSON.stringify(recs, null, 2);
      const res = await askAdvisor(`In two short sentences, why are ${plantNames} good for ${prefs.sunlight} light and ${prefs.space} space?`, plantContext);
      if (res.success) {
        setAiExplanation(res.answer);
      } else {
        setAiExplanation("AI explanation unavailable at this time.");
      }
    } else {
      setAiExplanation(null);
    }
    setFindingPlants(false);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const remainingCount = tasks.length - completedCount;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2>🌿 GardenBuddy AI</h2>
        <div className="connection-status" style={{ fontSize: '0.85rem', marginBottom: '24px', opacity: 0.8 }}>
          Status: {backendStatus === 'loading' ? '⏳ Checking...' : backendStatus === 'fully_connected' ? '✅ Online (AI Ready)' : backendStatus === 'backend_only' ? '⚠️ Backend Only (No AI)' : '❌ Disconnected'}
        </div>
        <nav className="nav-links">
          <div className="nav-link" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>🏠 Dashboard</div>
          <div className="nav-link" onClick={() => document.getElementById('my-garden-section').scrollIntoView({behavior: 'smooth'})}>🪴 My Garden</div>
          <div className="nav-link" onClick={() => document.getElementById('daily-tasks-section').scrollIntoView({behavior: 'smooth'})}>📋 Daily Tasks</div>
          <div className="nav-link" onClick={() => document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'})}>🔍 Plant Finder</div>
          <div className="nav-link" onClick={() => document.getElementById('ai-advisor-section').scrollIntoView({behavior: 'smooth'})}>✨ AI Garden Assistant</div>
          
          <div className="nav-link" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '0.9rem', color: '#ccd5ae', cursor: 'default' }}>Explore</div>
          <div className="nav-link" onClick={() => { setPrefs({...prefs, searchQuery: 'Decor'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}) }}>🪴 Decor & Styling</div>
          <div className="nav-link" onClick={() => { setPrefs({...prefs, searchQuery: 'Ayurvedic'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}) }}>🌿 Ayurvedic & Wellness</div>
          <div className="nav-link" onClick={() => { setPrefs({...prefs, searchQuery: ''}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}) }}>🏡 Outdoor Garden</div>
          <div className="nav-link" onClick={() => { setPrefs({...prefs, searchQuery: 'Butterfly'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}) }}>🦋 Butterfly-Friendly Garden</div>
        </nav>
      </aside>

      <main className="main-content">
        <section className="welcome-section" style={{marginBottom: '24px'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, Gardener! 🌿</h1>
              <p style={{ color: '#666' }}>Today is {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}. Let's check on your garden.</p>
            </div>
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6', minWidth: '250px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>📍 My Garden Profile</h4>
              <input type="text" className="advisor-input" placeholder="City or Climate Zone..." value={prefs.climateZone} onChange={e => handlePrefChange('climateZone', e.target.value)} style={{ padding: '4px 8px', minHeight: 'auto', marginBottom: '8px', fontSize: '0.8rem' }} />
              <select className="advisor-input" value={prefs.gardenType} onChange={e => handlePrefChange('gardenType', e.target.value)} style={{ padding: '4px 8px', minHeight: 'auto', marginBottom: 0, fontSize: '0.8rem' }}>
                <option value="">Select Setup...</option>
                <option value="Balcony">Apartment Balcony / Terrace</option>
                <option value="Window">Window Boxes / Indoor</option>
                <option value="Backyard">Outdoor Backyard / Raised Beds</option>
                <option value="Urban">Small Urban Garden</option>
              </select>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <h3>Daily Progress</h3>
            <div style={{background: '#e9ecef', borderRadius: '4px', height: '8px', marginTop: '8px'}}>
              <div style={{background: '#557b5e', width: `${tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100)}%`, height: '100%', borderRadius: '4px'}}></div>
            </div>
            <p className="value" style={{fontSize: '1.2rem', marginTop: '8px'}}>{completedCount} / {tasks.length} Tasks</p>
          </div>
          <div className="stat-card"><h3>Remaining Tasks</h3><p className="value">{remainingCount}</p></div>
          <div className="stat-card"><h3>Saved Plants</h3><p className="value">{myPlants.length}</p></div>
        </section>

        <section className="content-grid">
          <div className="card" style={{ gridColumn: '1 / -1', background: '#fefae0', borderLeft: '4px solid #dda15e' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#bc6c25' }}>💡 Garden Tip of the Day</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#283618' }}>{tipOfTheDay}</p>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="card" style={{ background: '#f8f9fa', textAlign: 'center', padding: '16px', cursor: 'pointer', border: '1px solid #e9ecef' }} onClick={() => { setPrefs({...prefs, searchQuery: 'Ayurvedic'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}); }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌿</div>
              <strong style={{ fontSize: '0.9rem' }}>Explore Ayurvedic Plants</strong>
            </div>
            <div className="card" style={{ background: '#f8f9fa', textAlign: 'center', padding: '16px', cursor: 'pointer', border: '1px solid #e9ecef' }} onClick={() => { setPrefs({...prefs, searchQuery: 'Decor'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}); }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛋️</div>
              <strong style={{ fontSize: '0.9rem' }}>Find Plants for My Home</strong>
            </div>
            <div className="card" style={{ background: '#f8f9fa', textAlign: 'center', padding: '16px', cursor: 'pointer', border: '1px solid #e9ecef' }} onClick={() => { setPrefs({...prefs, searchQuery: 'Container'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}); }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏢</div>
              <strong style={{ fontSize: '0.9rem' }}>Decorate My Balcony</strong>
            </div>
            <div className="card" style={{ background: '#f8f9fa', textAlign: 'center', padding: '16px', cursor: 'pointer', border: '1px solid #e9ecef' }} onClick={() => { setPrefs({...prefs, searchQuery: 'Beginner'}); document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'}); }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌱</div>
              <strong style={{ fontSize: '0.9rem' }}>Discover Easy-Care Plants</strong>
            </div>
          </div>
          <div id="daily-tasks-section" className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2>Tasks for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={handleSuggestTasks} disabled={suggestingTasks} className="tag-btn" style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#e9edc9', border: '1px solid #ccd5ae', borderRadius: '4px', cursor: 'pointer' }}>
                  {suggestingTasks ? '⏳ Thinking...' : '✨ Suggest Tasks'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccd5ae', borderRadius: '4px', overflow: 'hidden' }}>
                  <button onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }} style={{ border: 'none', background: '#f8f9fa', padding: '4px 8px', cursor: 'pointer' }}>◀</button>
                  <input 
                    type="date" 
                    className="advisor-input" 
                    style={{ width: 'auto', padding: '4px 8px', minHeight: 'auto', marginBottom: 0, border: 'none', borderRadius: 0 }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <button onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }} style={{ border: 'none', background: '#f8f9fa', padding: '4px 8px', cursor: 'pointer' }}>▶</button>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input 
                type="text" 
                className="advisor-input" 
                placeholder="What needs to be done?" 
                value={newTaskTitle} 
                onChange={(e) => setNewTaskTitle(e.target.value)} 
                style={{ flex: 1, minHeight: 'auto', padding: '8px 12px' }}
              />
              <button type="submit" className="advisor-btn" disabled={!newTaskTitle.trim()} style={{ width: 'auto', padding: '8px 16px' }}>Add</button>
            </form>

            <div className="task-list">
              {tasks.filter(t => (t.due_date && t.due_date.startsWith(selectedDate)) || (!t.due_date && selectedDate === new Date().toISOString().split('T')[0])).length === 0 && <p>No tasks scheduled for this day.</p>}
              {tasks.filter(t => (t.due_date && t.due_date.startsWith(selectedDate)) || (!t.due_date && selectedDate === new Date().toISOString().split('T')[0])).map(task => (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className={`task-item ${task.completed ? 'completed' : ''}`} style={{ flex: 1, marginBottom: 0 }}>
                    <input type="checkbox" className="task-checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                    <span>{task.text}</span>
                  </label>
                  <button onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontSize: '1.2rem', padding: '0 8px' }}>×</button>
                </div>
              ))}
            </div>
          </div>
          
          <div id="my-garden-section" className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2>My Garden</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCompanionCheck} disabled={checkingCompanions} className="tag-btn" style={{ background: '#e9edc9', color: '#283618', border: '1px solid #ccd5ae', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>{checkingCompanions ? '⏳ Checking...' : '🌱 Check Companions'}</button>
                <button onClick={() => document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'})} className="tag-btn" style={{ background: '#557b5e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Search Library</button>
              </div>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (customPlantName.trim()) {
                handleAddPlant({ name: customPlantName.trim(), species: 'Custom Plant', sunlight: 'Unknown', watering: 'Unknown', container: false, notes: 'Manually added plant' });
                setCustomPlantName('');
              }
            }} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input 
                type="text" 
                className="advisor-input" 
                style={{ flex: 1, padding: '8px 12px', minHeight: 'auto', marginBottom: 0 }} 
                placeholder="Or manually type a plant name..." 
                value={customPlantName} 
                onChange={e => setCustomPlantName(e.target.value)} 
              />
              <button type="submit" className="advisor-btn" style={{ padding: '8px 16px', minHeight: 'auto' }}>+ Add</button>
            </form>
            
            <div className="task-list">
              {myPlants.length === 0 && <p>No plants yet! Use the Plant Finder to add some.</p>}
              {myPlants.map(plant => (
                <div key={plant.id} style={{padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <strong>{plant.name}</strong> <em style={{fontSize: '0.8rem', color: '#666'}}>{plant.species}</em>
                    <div style={{fontSize: '0.8rem', marginTop: '4px'}}>💧 {plant.watering} | ☀️ {plant.sunlight}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="plant-finder-section" className="card">
            <h2>Plant Finder & Library</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setPrefs({...prefs, searchQuery: 'Ayurvedic'})} className="tag-btn" style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '12px', cursor: 'pointer' }}>🌿 Ayurvedic & Wellness</button>
              <button onClick={() => setPrefs({...prefs, searchQuery: 'Decor'})} className="tag-btn" style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#e2e3e5', border: '1px solid #d6d8db', borderRadius: '12px', cursor: 'pointer' }}>🪴 Decor & Styling</button>
              <button onClick={() => setPrefs({...prefs, searchQuery: 'Beginner'})} className="tag-btn" style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>🌱 Easy to Grow</button>
              <button onClick={() => setPrefs({...prefs, searchQuery: 'Container'})} className="tag-btn" style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>📦 Container Friendly</button>
            </div>
            <form className="advisor-form" onSubmit={findPlants}>
              <input 
                type="text" 
                className="advisor-input" 
                placeholder="Search plants (e.g. Spider Plant, Pollinator)..." 
                value={prefs.searchQuery} 
                onChange={e => handlePrefChange('searchQuery', e.target.value)} 
                style={{marginBottom: '12px'}}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select className="advisor-input" style={{minHeight: '40px', flex: 1}} value={prefs.sunlight} onChange={e => handlePrefChange('sunlight', e.target.value)}>
                  <option value="">Any Light</option>
                  <option value="Full Sun">Full Sun (Bright)</option>
                  <option value="Partial Sun">Partial Sun / Indirect</option>
                  <option value="Any">Low Light / Any</option>
                </select>
                <select className="advisor-input" style={{minHeight: '40px', flex: 1}} value={prefs.space} onChange={e => handlePrefChange('space', e.target.value)}>
                  <option value="">Any Room / Space</option>
                  <option value="Container">Containers / Desk</option>
                  <option value="Garden">Outdoor Garden Bed</option>
                </select>
                <select className="advisor-input" style={{minHeight: '40px', flex: 1}} value={prefs.experience} onChange={e => handlePrefChange('experience', e.target.value)}>
                  <option value="">Any Experience</option>
                  <option value="Beginner">Beginner-Friendly</option>
                  <option value="Intermediate">Intermediate</option>
                </select>
              </div>
              <button type="submit" className="advisor-btn" disabled={findingPlants}>
                {findingPlants ? 'Searching...' : 'Search Library'}
              </button>
            </form>
            <p style={{fontSize: '0.8rem', color: '#666', marginTop: '8px'}}>* Search our curated catalogue of indoor, office, edible, and pollinator plants.</p>
            
            {prefs.searchQuery && prefs.searchQuery.toLowerCase().includes('ayurvedic') && (
              <div style={{ background: '#fff3cd', borderLeft: '4px solid #ffc107', padding: '12px', marginTop: '16px', borderRadius: '4px', fontSize: '0.85rem', color: '#856404' }}>
                <strong>⚠️ Traditional Wellness Note:</strong> This application provides gardening advice, not medical advice. Traditional uses are for informational purposes only. Do not consume plants or prepare remedies without consulting a qualified healthcare professional. Natural plants can cause allergies or interact with medications.
              </div>
            )}

            {findingPlants && recommendations === null && (
               <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
                 <span className="leaf-spinner">🌿</span>
                 <span className="spinner-text">Searching database...</span>
               </div>
            )}

            {recommendations !== null && !findingPlants && (
              <div style={{marginTop: '16px'}}>
                {recommendations.length > 0 ? (
                  <>
                    <h4>Recommended for you:</h4>
                    <ul style={{paddingLeft: '20px', margin: '8px 0', listStyle: 'none'}}>
                      {recommendations.map(r => (
                        <li key={r.id} style={{marginBottom: '12px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #557b5e'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                            <div>
                              <strong>{r.name}</strong> <em>({r.species})</em>
                              <span style={{ fontSize: '0.7rem', background: '#e9ecef', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>{r.container ? '🪴 Container' : '🏡 Ground'}</span>
                              <span style={{ fontSize: '0.7rem', background: r.experience === 'Beginner' ? '#d4edda' : '#fff3cd', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>{r.experience || 'Standard'}</span>
                              <br/>
                              <small style={{ color: '#666' }}>Season: {r.season} | Watering: {r.watering} | {r.notes}</small>
                            </div>
                            <button onClick={() => handleAddPlant(r)} className="tag-btn" style={{background: '#557b5e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'}}>+ Add</button>
                          </div>
                        </li>
                      ))}
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

          <div id="ai-advisor-section" className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>AI Plant Advisor <span style={{fontSize: '0.8rem', background: '#e9edc9', padding: '2px 6px', borderRadius: '4px'}}>✨ AI-Generated</span></h2>
            <form className="advisor-form" onSubmit={handleAdvisorSubmit}>
              <textarea className="advisor-input" placeholder="Ask about your plants..." value={question} onChange={(e) => setQuestion(e.target.value)} disabled={advisorState.loading} />
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setQuestion(`Explain a problem with my ${myPlants.length > 0 ? myPlants[0].name : 'plant'}: [DESCRIBE PROBLEM HERE]`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>🩺 Explain a Problem</button>
                <button type="button" onClick={() => setQuestion(`Create a weekly care plan for my garden: ${myPlants.map(p=>p.name).join(', ')}`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>📋 Care Plan</button>
                <button type="button" onClick={() => setQuestion(`Recommend plants for my ${prefs.gardenType || 'space'} in ${prefs.climateZone || 'my climate'}.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>🪴 Recommend Plants</button>
                <button type="button" onClick={() => setQuestion(`Help me style my ${prefs.gardenType || 'room'} using decorative indoor plants. I have ${prefs.sunlight || 'medium light'} and ${prefs.space || 'limited space'}. Suggest specific trailing, upright, or colorful plants and their placement.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e2e3e5', border: '1px solid #d6d8db', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'}}>🛋️ Style My Room</button>
                <button type="button" onClick={() => setQuestion(`Help me plan a ${prefs.gardenType === 'Balcony' ? 'balcony' : 'office'} garden.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>🏢 Plan Office/Balcony</button>
                <button type="button" onClick={() => setQuestion(`Suggest flowers for pollinators in ${prefs.climateZone || 'my area'}.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>🌸 Pollinator Flowers</button>
                <button type="button" onClick={() => setQuestion(`I want to build a Butterfly-Friendly Garden in ${prefs.climateZone || 'my area'} using a ${prefs.gardenType || 'standard setup'}. Please suggest some native nectar-producing flowers and host plants. Explain the difference between nectar and host plants, suggest pesticide-aware practices, and note any uncertainty in regional data.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#ffddd2', border: '1px solid #e29578', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'}}>🦋 Butterfly Garden</button>
                <button type="button" onClick={() => setQuestion(`Explain companion planting for ${myPlants.length > 0 ? myPlants.map(p=>p.name).join(', ') : 'vegetables'}.`)} className="tag-btn" style={{fontSize: '0.8rem', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '12px', cursor: 'pointer'}}>🌱 Companion Planting</button>
              </div>

              <button type="submit" className="advisor-btn" disabled={advisorState.loading || !question.trim()}>
                Ask AI
              </button>
            </form>
            
            {advisorState.loading && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
                <span className="leaf-spinner">🌿</span>
                <span className="spinner-text">GardenBuddy is thinking... (local AI model may take a few seconds)</span>
              </div>
            )}

            {advisorState.error && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong>Error:</strong> {advisorState.error}
                <div style={{marginTop: '8px'}}>
                  <button className="advisor-btn" style={{padding: '4px 8px'}} onClick={handleAdvisorSubmit}>Retry</button>
                </div>
              </div>
            )}
            
            {advisorState.answer && <div style={{ marginTop: '16px', padding: '16px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px' }}><h4 style={{ margin: '0 0 8px 0', color: '#354f52' }}>Advisor says:</h4><div className="markdown-body" style={{ margin: 0, lineHeight: '1.5', fontSize: '0.95rem' }}><ReactMarkdown>{advisorState.answer}</ReactMarkdown></div></div>}
            {backendStatus !== 'fully_connected' && <p className="not-connected-msg">⚠️ AI service is unavailable right now.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
