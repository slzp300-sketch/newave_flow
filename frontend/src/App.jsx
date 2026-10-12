import { RouterProvider } from 'react-router-dom'
import router from './router'
import AppUpdate from './components/common/AppUpdate'
import { AppMotion } from './components/common/Motion'

export default function App() {
  return <AppMotion><RouterProvider router={router} /><AppUpdate /></AppMotion>
}
