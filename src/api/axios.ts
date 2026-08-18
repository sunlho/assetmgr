import axios from "axios";


const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    // You can add authorization headers or other custom logic here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle errors globally, e.g., logging, notifications, etc.
    return Promise.reject(error);
  }
);




export default api;
export { api };

