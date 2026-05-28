import {RouterProvider} from 'react-router-dom'
import {router} from './app.routes.jsx'
import { AuthProvider } from './features/auth/auth.context.jsx' 
import {InterviewProvider} from "./features/interview/interview.context.jsx"
import { ThemeProvider } from "./features/theme/theme.context.jsx"
function App(){
  return (
    <ThemeProvider>
      <AuthProvider>
        <InterviewProvider>
          <RouterProvider router={router} />
        </InterviewProvider>
      </AuthProvider>
    </ThemeProvider>

  )
}

export default App
