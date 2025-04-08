import axios from 'axios';

// Create an axios instance with the base URL of your backend
const api = axios.create({
  baseURL: 'http://localhost:5000', // Direct connection to Flask backend
  headers: {
    'Content-Type': 'application/json',
  },
  // Disable withCredentials as it might cause CORS issues
  withCredentials: false,
  // Add timeout to prevent hanging requests
  timeout: 60000 // Increased timeout for processing large documents
});

// Function to upload a document
export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Log the file being uploaded for debugging
    console.log('Uploading file:', file.name, file.type, file.size);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Check if the response contains an error message
    if (response.data && response.data.error) {
      console.error('Server reported error:', response.data.error);
      throw new Error(response.data.error || 'Error processing document on server');
    }
    
    return response.data;
  } catch (error) {
    // More detailed error handling
    if (error.response) {
      console.error('Server error:', error.response.status, error.response.data);
      throw new Error(
        (error.response.data && error.response.data.error) || 
        'Error processing document on server'
      );
    } else if (error.request) {
      console.error('No response from server:', error.request);
      throw new Error('No response from server. Please check if the backend is running.');
    } else {
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
};

// Function to ask a question about documents
export const askQuestion = async (question) => {
  try {
    console.log("Sending question to backend:", question);
    
    // Use direct axios call to ensure we're hitting the right endpoint
    const response = await axios.post("http://127.0.0.1:5000/ask", { 
      question: question
    });
    
    console.log("Response from backend:", response.data);
    
    // Check if the response contains an error message
    if (response.data && response.data.error) {
      console.error('Server reported error:', response.data.error);
      throw new Error(response.data.error || 'Error processing question on server');
    }
    
    return response.data;
  } catch (error) {
    // More detailed error handling
    if (error.response) {
      console.error('Server error:', error.response.status, error.response.data);
      throw new Error(
        (error.response.data && error.response.data.error) || 
        'Error processing question on server'
      );
    } else if (error.request) {
      console.error('No response from server:', error.request);
      throw new Error('No response from server. Please check if the backend is running.');
    } else {
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
};

export default api;