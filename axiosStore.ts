import axios from 'axios';
import { URL } from './utils/url';

const instance = axios.create({
  baseURL: URL,
});
instance.interceptors.request.use((config) => {
  // config.headers = {
  //   'Content-Type': 'application/json',
  //   Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
  //   ...config.headers,
  // };
  config.params = {
    ...config.params,
  };
  return config;
});
export default instance;
