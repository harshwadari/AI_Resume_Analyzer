import {RouterProvider} from 'react-router-dom'
import {router} from './app.routes.jsx'
import { AuthProvider } from './features/auth/auth.context.jsx' 
import PrivateStateBoundary from './features/auth/components/PrivateStateBoundary.jsx';
import { ThemeProvider } from "./features/theme/theme.context.jsx"
function App(){
  return (
    <ThemeProvider>
      <AuthProvider>
        <PrivateStateBoundary><RouterProvider router={router} /></PrivateStateBoundary>
      </AuthProvider>
    </ThemeProvider>

  )
}

export default App
