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

export const askAdvisor = async (question) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/advisor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
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
