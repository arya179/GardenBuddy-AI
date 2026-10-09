import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { checkHealth, askAdvisor, getTasks, toggleTaskCompletion, getPreferences, savePreferences, searchLocation, getWeather } from './api';
import { PLANT_DATA } from './plantData';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [prefs, setPrefs] = useState({ sunlight: '', space: '', searchQuery: '', climateZone: '', gardenType: [], city: '', region: '', country: '', lat: '', lon: '', container: '', maintenance: '' });

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
  const [suggestedTasksModal, setSuggestedTasksModal] = useState(null);
  const [fetchingPlantationData, setFetchingPlantationData] = useState(false);
  const [fetchingRecommendations, setFetchingRecommendations] = useState(false);
  const [plantationDataModal, setPlantationDataModal] = useState(null);
  
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  
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
        gardenType: dbPrefs.gardenType ? (() => { try { return JSON.parse(dbPrefs.gardenType); } catch { return []; } })() : [],
        climateZone: dbPrefs.climateZone || '',
        city: dbPrefs.city || '',
        region: dbPrefs.region || '',
        country: dbPrefs.country || '',
        lat: dbPrefs.lat || '',
        lon: dbPrefs.lon || '',
        container: dbPrefs.container || '',
        maintenance: dbPrefs.maintenance || ''
      });
      import('./api').then(async ({ getPlants }) => {
        const dbPlants = await getPlants();
        setMyPlants(dbPlants);
      });
      
      if (dbPrefs.lat && dbPrefs.lon) {
        fetchWeather(dbPrefs.lat, dbPrefs.lon);
      }
    };
    fetchData();
  }, []);

  const [weatherError, setWeatherError] = useState(null);

  const fetchWeather = async (lat, lon) => {
    setFetchingWeather(true);
    setWeatherError(null);
    setWeatherData(null); // Clear stale data to prevent confusing it with a new city
    
    const { data, error } = await getWeather(lat, lon);
    if (error || !data) {
      setWeatherError(error || 'Could not retrieve live weather. You are seeing offline/cached guidance if available.');
    } else {
      setWeatherData(data);
    }
    setFetchingWeather(false);
  };

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

  const toggleGardenType = (type) => {
    const currentTypes = Array.isArray(prefs.gardenType) ? prefs.gardenType : [];
    const newTypes = currentTypes.includes(type) 
      ? currentTypes.filter(t => t !== type) 
      : [...currentTypes, type];
    handlePrefChange('gardenType', newTypes);
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
    
    let contextStr = `\n--- Context ---\n`;
    if (prefs.city) contextStr += `Location: ${prefs.city}, ${prefs.region}, ${prefs.country}\n`;
    if (prefs.gardenType.length > 0) contextStr += `Garden Type: ${prefs.gardenType.join(', ')}\n`;
    
    if (weatherData && weatherData.current) {
      contextStr += `Weather (Updated: ${new Date(weatherData.current.time).toLocaleString()}): Temp ${weatherData.current.temperature_2m}°C, Humidity ${weatherData.current.relative_humidity_2m}%, Rain ${weatherData.current.precipitation}mm\n`;
    }
    
    if (myPlants.length > 0) {
      contextStr += `My Plants: ${myPlants.map(p => `${p.name} (${p.species}) - ${p.sunlight}, ${p.watering}`).join(' | ')}\n`;
    }
    
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length > 0) {
      contextStr += `Incomplete Tasks for ${selectedDate}: ${incompleteTasks.map(t => t.text).join(', ')}\n`;
    }
    
    const qLower = question.toLowerCase();
    if (qLower.includes('plant') || qLower.includes('grow') || qLower.includes('flower') || qLower.includes('vegetable') || qLower.includes('butterfly') || qLower.includes('office')) {
      contextStr += `Curated Plant Catalogue: ${PLANT_DATA.map(p => `${p.name} (${p.notes})`).join(' | ')}\n`;
    }
    
    contextStr += `Instructions: You are the GardenBuddy AI. Use the provided context to answer. Distinguish live data from general gardening knowledge. Never fabricate weather observations or regional facts. Only suggest tasks you are confident about based on the context. If suggesting tasks, users will review them before saving.\n`;
    
    const result = await askAdvisor(question, contextStr);
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
    const randomSeed = Math.floor(Math.random() * 10000);
    
    const question = `Suggest 3 gardening tasks for today.`;
    const context = `My plants: ${plantNames}.${profileContext} Focus on varied tasks like pruning, watering, or pest checking. Random seed: ${randomSeed}. Format ONLY as a bulleted list using asterisks (*). No intro/outro text.`;
    
    const res = await askAdvisor(question, context);
    setSuggestingTasks(false);
    if (res.success) {
      const parsedTasks = res.answer.split('\n').filter(line => line.trim().startsWith('*') || line.trim().startsWith('-')).map(line => line.replace(/^[-*]\s*/, '').trim());
      if (parsedTasks.length > 0) {
        setSuggestedTasksModal(parsedTasks);
      } else {
        setQuestion(`Suggested tasks:\n${res.answer}`);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    } else {
      alert("Failed to get suggestions. " + res.error);
    }
  };

  const handleFetchPlantationData = async () => {
    const targetCity = prefs.city || prefs.climateZone;
    if (!targetCity) {
      alert("Please enter a City or Climate Zone first!");
      return;
    }
    setFetchingPlantationData(true);
    const month = new Date().toLocaleString('default', { month: 'long' });
    const question = `Using your general horticultural knowledge, suggest 5 gardening tasks for ${targetCity} in ${month}.`;
    const context = `Provide general seasonal guidance for this climate. Do not refuse by saying you lack real-time data. Include tasks like sowing, pruning, or repotting. Format ONLY as a bulleted list using asterisks (*). Do not include any introductory or concluding text. No JSON.`;
    
    const res = await askAdvisor(question, context);
    setFetchingPlantationData(false);
    if (res.success) {
      const parsedTasks = res.answer.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('*') || line.startsWith('-'))
        .map(line => line.replace(/^[-*]\s*/, '').trim());
        
      if (parsedTasks.length > 0) {
        setPlantationDataModal(parsedTasks);
      } else {
        // Fallback if the AI didn't use bullets
        setPlantationDataModal([res.answer]);
      }
    } else {
      alert("Failed to fetch data: " + res.error);
    }
  };

  const handleLocationSearch = async (e) => {
    e.preventDefault();
    if (!prefs.climateZone.trim()) return;
    setIsSearchingLocation(true);
    setLocationError(null);
    try {
      const { data, error } = await searchLocation(prefs.climateZone);
      if (error) {
        setLocationError(error);
        setLocationSearchResults([]);
      } else {
        setLocationSearchResults(data || []);
      }
      setShowLocationDropdown(true);
    } catch (err) {
      setLocationError("Failed to search location.");
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const selectLocation = (loc) => {
    const newPrefs = {
      ...prefs,
      climateZone: loc.name,
      city: loc.name,
      region: loc.admin1 || '',
      country: loc.country || '',
      lat: String(loc.latitude),
      lon: String(loc.longitude)
    };
    setPrefs(newPrefs);
    savePreferences(newPrefs);
    setShowLocationDropdown(false);
    fetchWeather(loc.latitude, loc.longitude);
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

  const handleLocalRecommendations = async () => {
    if (!prefs.city) {
      alert("Please search and save your city in the Garden Profile first!");
      return;
    }
    setFetchingRecommendations(true);
    
    const catalogue = PLANT_DATA.map(p => `- ${p.name} (${p.notes})`).join('\n');
    const gardenContext = prefs.gardenType.length > 0 ? `I am planting in a: ${prefs.gardenType.join(', ')}.` : '';
    const lightSpace = `Sunlight: ${prefs.sunlight || 'Any'}. Space: ${prefs.space || 'Any'}.`;
    
    const question = `Based on my local climate in ${prefs.city}, ${prefs.region}, ${prefs.country}, recommend suitable plants.`;
    const context = `Garden: ${gardenContext} ${lightSpace}\nCatalogue:\n${catalogue}\nFormat with clear headings (indoor, herbs, flowers). Explain explicitly why each suits the climate and space. Do not assume all plants suit a city merely because of its name.`;

    const res = await askAdvisor(question, context);
    setFetchingRecommendations(false);
    
    if (res.success) {
      setPlantationDataModal(res.answer);
    } else {
      alert("Failed to fetch recommendations: " + res.error);
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
      const res = await askAdvisor(
        `Using your general gardening knowledge, briefly explain why ${plantNames} thrive in ${prefs.sunlight || 'any'} light and ${prefs.space || 'any'} space.`, 
        plantContext + "\nRespond in plain text as a single concise paragraph. Do NOT use markdown like asterisks (**). Do NOT include any introductory or concluding text."
      );
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
      {suggestedTasksModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', maxWidth: '500px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#283618', borderBottom: '2px solid #e9edc9', paddingBottom: '12px' }}>✨ AI Task Suggestions</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>Based on your current garden and climate, here are a few things you could do today:</p>
            <ul style={{ paddingLeft: '20px', margin: '24px 0' }}>
              {suggestedTasksModal.map((task, idx) => (
                <li key={idx} style={{ marginBottom: '16px', lineHeight: '1.5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ flex: 1, color: '#283618' }}>{task}</span>
                    <button onClick={() => { handleAddTask(null, task); setSuggestedTasksModal(prev => prev.filter((_, i) => i !== idx)); }} className="tag-btn" style={{ background: '#557b5e', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add to To-Do</button>
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button onClick={() => setSuggestedTasksModal(null)} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#f8f9fa', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {plantationDataModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#bc6c25', borderBottom: '2px solid #e9edc9', paddingBottom: '12px' }}>🌱 Seasonal Plantation Activities</h3>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem', color: '#283618', margin: '20px 0' }}>
              {Array.isArray(plantationDataModal) ? (
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {plantationDataModal.map((task, idx) => (
                    <li key={idx} style={{ marginBottom: '16px', lineHeight: '1.5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <span style={{ flex: 1 }}>{task}</span>
                        {!task.toLowerCase().includes('general guidance only') && (
                          <button onClick={() => { 
                            if (!tasks.some(t => t.text === task)) {
                              handleAddTask(null, task); 
                            } else {
                              alert("Task is already in your To-Do list!");
                            }
                            // Optional: remove from list
                            // setPlantationDataModal(prev => prev.filter((_, i) => i !== idx)); 
                          }} className="tag-btn" style={{ background: '#dda15e', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add to To-Do</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                plantationDataModal
              )}
            </div>
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button onClick={() => setPlantationDataModal(null)} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#f8f9fa', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {showSetupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#283618', borderBottom: '2px solid #e9edc9', paddingBottom: '12px' }}>🏡 Garden Setup & Preferences</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>Select your garden types (multiple allowed):</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Indoor/home plants', 'Office plants', 'Balcony or container garden', 'Terrace or rooftop garden', 'Outdoor/backyard garden', 'Vegetable garden', 'Flower garden', 'Butterfly and pollinator garden'].map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', background: '#f8f9fa', padding: '6px 12px', border: '1px solid #dee2e6', borderRadius: '20px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.gardenType.includes(t)} onChange={() => toggleGardenType(t)} /> {t}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Sunlight</h4>
                <select className="advisor-input" value={prefs.sunlight} onChange={e => handlePrefChange('sunlight', e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                  <option value="">Any</option>
                  <option value="Full Sun">Full Sun</option>
                  <option value="Partial Shade">Partial Shade</option>
                  <option value="Full Shade">Full Shade</option>
                </select>
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Growing Space</h4>
                <select className="advisor-input" value={prefs.space} onChange={e => handlePrefChange('space', e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                  <option value="">Any</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </select>
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Container Preferences</h4>
                <select className="advisor-input" value={prefs.container} onChange={e => handlePrefChange('container', e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                  <option value="">Any</option>
                  <option value="Pots">Pots</option>
                  <option value="Raised Beds">Raised Beds</option>
                  <option value="In-ground">In-ground</option>
                </select>
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Maintenance</h4>
                <select className="advisor-input" value={prefs.maintenance} onChange={e => handlePrefChange('maintenance', e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                  <option value="">Any</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setShowSetupModal(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#f8f9fa', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Done</button>
            </div>
          </div>
        </div>
      )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, Gardener! 🌿</h1>
              <p style={{ color: '#666' }}>Today is {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
            </div>
            
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, color: '#283618', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📍 My Garden Profile
                  {prefs.city && <span style={{fontSize: '0.75rem', padding: '2px 8px', background: '#d4edda', color: '#155724', borderRadius: '12px', fontWeight: 'normal'}}>Saved: {prefs.city}, {prefs.country}</span>}
                </h3>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                  <form onSubmit={handleLocationSearch} style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="advisor-input" placeholder="Search City..." value={prefs.climateZone} onChange={e => { handlePrefChange('climateZone', e.target.value); setShowLocationDropdown(false); }} style={{ padding: '8px 12px', minHeight: 'auto', marginBottom: '0', fontSize: '0.9rem', flex: 1 }} />
                    <button type="submit" disabled={isSearchingLocation} style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#557b5e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {isSearchingLocation ? 'Searching...' : 'Search'}
                    </button>
                  </form>
                  {showLocationDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', borderRadius: '6px', zIndex: 100, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                      {locationError && <div style={{ padding: '12px', color: '#dc3545', fontSize: '0.85rem' }}>{locationError} <button onClick={handleLocationSearch} style={{marginLeft: '8px', cursor: 'pointer', border: '1px solid #dc3545', background: 'transparent', borderRadius: '4px'}}>Retry</button></div>}
                      {locationSearchResults.length === 0 && !locationError && <div style={{ padding: '12px', fontSize: '0.85rem', color: '#666' }}>No cities found.</div>}
                      {locationSearchResults.map((loc, idx) => (
                        <div key={idx} onClick={() => selectLocation(loc)} style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '0.9rem' }}>
                          <strong>{loc.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>{loc.admin1 ? `${loc.admin1}, ` : ''}{loc.country}</div>
                        </div>
                      ))}
                      <div style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid #eee', background: '#f8f9fa' }}>
                        <button onClick={() => setShowLocationDropdown(false)} style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>Close</button>
                      </div>
                    </div>
                  )}
                </div>
                
                <button type="button" onClick={() => setShowSetupModal(true)} style={{ padding: '8px 16px', fontSize: '0.9rem', background: 'white', color: '#283618', border: '1px solid #ccd5ae', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                  ⚙️ Garden Setup ({prefs.gardenType.length})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #e9ecef', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', marginRight: '8px' }}>Quick Actions:</span>
                <button type="button" onClick={handleFetchPlantationData} disabled={fetchingPlantationData || (!prefs.city && !prefs.climateZone)} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#dda15e', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: (!prefs.city && !prefs.climateZone) ? 0.5 : 1 }}>
                  {fetchingPlantationData ? 'Loading...' : '📅 Local Planting Calendar'}
                </button>
                <button type="button" onClick={() => document.getElementById('plant-finder-section').scrollIntoView({behavior: 'smooth'})} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🌿 Find Local Plants
                </button>
                <button type="button" onClick={() => document.getElementById('daily-tasks-section').scrollIntoView({behavior: 'smooth'})} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#e2e3e5', color: '#383d41', border: '1px solid #d6d8db', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📋 Today's Tasks
                </button>
              </div>
            </div>
          </div>
          
          {fetchingWeather && (
            <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid #dee2e6', marginTop: '16px', color: '#666', fontSize: '0.9rem' }}>
              ⏳ Fetching live weather data for {prefs.city}...
            </div>
          )}
          
          {weatherError && !fetchingWeather && (
            <div style={{ background: '#fff3cd', padding: '16px', borderRadius: '8px', border: '1px solid #ffeeba', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#856404', fontSize: '0.9rem' }}>
                ⚠️ {weatherError}
              </div>
              <button onClick={() => fetchWeather(prefs.lat, prefs.lon)} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#ffeeba', color: '#856404', border: '1px solid #ffc107', borderRadius: '4px', cursor: 'pointer' }}>
                Retry Connection
              </button>
            </div>
          )}

          {weatherData && weatherData.current && !fetchingWeather && (
            <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid #dee2e6', marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#bc6c25' }}>🌤️ Local Weather ({prefs.city})</h4>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: '#283618' }}>
                  <div><strong>Temp:</strong> {weatherData.current.temperature_2m}°C</div>
                  <div><strong>Humidity:</strong> {weatherData.current.relative_humidity_2m}%</div>
                  <div><strong>Rain:</strong> {weatherData.current.precipitation} mm</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                  Last updated: {new Date(weatherData.current.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
              <div style={{ flex: 2, minWidth: '300px', background: 'white', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #dda15e', fontSize: '0.85rem' }}>
                <strong>💡 Garden Care Advisory:</strong><br/>
                {weatherData.current.temperature_2m > 30 ? "🔥 Hot weather: Check container soil moisture daily. Deep watering is recommended. " : ""}
                {weatherData.current.temperature_2m < 10 ? "❄️ Cold weather: Protect sensitive plants and reduce watering. " : ""}
                {weatherData.current.precipitation > 5 || (weatherData.daily && weatherData.daily.precipitation_probability_max && weatherData.daily.precipitation_probability_max[0] > 70) ? "🌧️ Rain expected: Avoid automatic watering. Ensure outdoor pots have proper drainage to prevent waterlogging." : (!weatherData.current.precipitation && weatherData.current.temperature_2m <= 30 && weatherData.current.temperature_2m >= 10 ? "🌤️ Fair conditions: Maintain regular watering schedule." : "")}
                <br/><span style={{color: '#666', fontSize: '0.75rem'}}>* Note: Indoor plants may not be affected by outside weather. Always check actual soil before watering.</span>
              </div>
            </div>
          )}
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" className="advisor-btn" disabled={findingPlants} style={{flex: 1}}>
                  {findingPlants ? 'Searching...' : 'Search Library'}
                </button>
                <button type="button" onClick={handleLocalRecommendations} disabled={fetchingRecommendations || !prefs.city} className="advisor-btn" style={{flex: 1, background: '#dda15e', color: 'white'}}>
                  {fetchingRecommendations ? 'Getting AI Recommendations...' : '✨ Get Local AI Recommendations'}
                </button>
              </div>
            </form>
            <p style={{fontSize: '0.8rem', color: '#666', marginTop: '8px'}}>* Search our curated catalogue or get AI recommendations based on your saved city profile.</p>
            
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
