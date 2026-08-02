import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAgentServerPlugin } from './src/agent/server/vite-agent-plugin'
import { createCommunityServerPlugin } from './src/server/community-server-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      hmr: { host: 'localhost' },
    },
    preview: {
      host: 'localhost',
      port: 4173,
      strictPort: true,
    },
    plugins: [
      react(),
      createAgentServerPlugin({
        apiKey: env.UPSTAGE_API_KEY,
        model: env.UPSTAGE_MODEL || 'solar-pro3',
        simpleModel: env.UPSTAGE_SIMPLE_MODEL || 'solar-mini',
        documentPipeline: {
          mode: 'python',
          environment: mode,
          pythonCommand: env.PYTHON_COMMAND || undefined,
        },
      }),
      createCommunityServerPlugin(),
    ],
  }
})
