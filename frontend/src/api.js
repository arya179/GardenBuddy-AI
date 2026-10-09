const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Health check failed:", error);
    return { success: false, error: error.message };
  }
};

export const askAdvisor = async (question, context = null) => {
  try {
    const payload = { question };
    if (context) payload.context = context;

    const response = await fetch(`${API_BASE_URL}/api/advisor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error((errData && errData.detail) || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, answer: data.answer };
  } catch (error) {
    console.error("Advisor request failed:", error);
    return { success: false, error: error.message };
  }
};

export const getTasks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tasks`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return [];
  }
};

export const toggleTaskCompletion = async (taskId, completed) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, { 
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task', completed }) // Basic update for now
    });
    return await response.json();
  } catch (error) {
    console.error("Failed to toggle task:", error);
  }
};

export const addTask = async (taskData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    return await response.json();
  } catch (error) {
    console.error("Failed to add task:", error);
  }
};

export const deleteTask = async (taskId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, { method: 'DELETE' });
    return await response.json();
  } catch (error) {
    console.error("Failed to delete task:", error);
  }
};

export const getPreferences = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/preferences`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return { sunlight: '', space: '' };
  }
};

export const savePreferences = async (prefs) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    });
    return await response.json();
  } catch (error) {
    console.error("Failed to save preferences:", error);
  }
};

export const getPlants = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plants`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch plants:", error);
    return [];
  }
};

export const addPlant = async (plantData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plantData)
    });
    return await response.json();
  } catch (error) {
    console.error("Failed to add plant:", error);
  }
};

export const updatePlant = async (plantId, plantData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plants/${plantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plantData)
    });
    return await response.json();
  } catch (error) {
    console.error("Failed to update plant:", error);
  }
};

export const deletePlant = async (plantId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plants/${plantId}`, { method: 'DELETE' });
    return await response.json();
  } catch (error) {
    console.error("Failed to delete plant:", error);
  }
};
