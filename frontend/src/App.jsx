import { RouterProvider } from 'react-router-dom'
import router from './router'
import AppUpdate from './components/common/AppUpdate'

export default function App() {
  return <><RouterProvider router={router} /><AppUpdate /></>
}
