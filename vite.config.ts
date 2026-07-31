import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAgentServerPlugin } from './src/agent/server/vite-agent-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [
      react(),
      createAgentServerPlugin({
        apiKey: env.UPSTAGE_API_KEY,
        model: env.UPSTAGE_MODEL || 'solar-pro3',
        documentPipeline: {
          mode: 'python',
          environment: mode,
          pythonCommand: env.PYTHON_COMMAND || undefined,
        },
      }),
    ],
  }
})
