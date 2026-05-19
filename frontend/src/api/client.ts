import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', null, {
            headers: { Authorization: `Bearer ${refresh}` }
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          err.config.headers.Authorization = `Bearer ${data.access_token}`
          return api(err.config)
        } catch { logout() }
      }
    }
    return Promise.reject(err)
  }
)

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

export default api
